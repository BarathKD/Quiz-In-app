#!/usr/bin/env bash
# End-to-end check of the API. Start the API first (dotnet run), then in another terminal: bash backend/smoke-test.sh
# Needs curl and jq.
B=${1:-http://localhost:5080}
J='Content-Type: application/json'
say() { echo; echo "== $1"; }

say "admin login"
ADMIN=$(curl -s -X POST $B/api/auth/login -H "$J" -d '{"email":"admin@quizin.local","password":"Admin@12345"}' | jq -r .token)
[ "$ADMIN" != "null" ] && echo "ok" || { echo "FAILED: no admin token"; exit 1; }
A="Authorization: Bearer $ADMIN"

say "create category / subcategory / subject"
CAT=$(curl -s -X POST $B/api/admin/categories -H "$J" -H "$A" -d '{"name":"Smoke Test","description":"demo","timerMinutes":5}')
echo "$CAT"; CID=$(echo "$CAT" | jq -r .id)
SUB=$(curl -s -X POST $B/api/admin/categories/$CID/subcategories -H "$J" -H "$A" -d '{"name":"Class 10"}')
echo "$SUB"; SID=$(echo "$SUB" | jq -r .id)
curl -s -X POST $B/api/admin/subcategories/$SID/subjects -H "$J" -H "$A" -d '{"name":"History","timerMinutes":3}'; echo

say "add one question"
curl -s -X POST $B/api/admin/questions -H "$J" -H "$A" -d '{"category":"Smoke Test","subcategory":"Class 10","subject":"History","difficulty":"easy","questionText":"Capital of Tamil Nadu?","options":[{"id":"a","text":"Chennai"},{"id":"b","text":"Madurai"}],"correctOptionId":"a","explanation":"Chennai is the capital."}'; echo

say "import CSV (3 good rows, 1 bad row)"
cat > /tmp/smoke.csv <<'CSV'
id,question,A,B,C,D,answer,explanation
1,"தமிழ்நாட்டின் தலைநகரம்?",சென்னை,மதுரை,கோவை,சேலம்,A,"சென்னை தலைநகரம்"
2,"2 + 2 = ?",3,4,5,6,4,Basic maths
3,"Largest ocean, in one word?",Atlantic,Pacific,Indian,Arctic,Pacific,
4,"Bad row",x,y,,,Z,
CSV
curl -s -X POST "$B/api/admin/import/csv?category=Smoke%20Test&subcategory=Class%2010&subject=History&difficulty=easy" -H "$A" --data-binary @/tmp/smoke.csv; echo

say "normal user reads content"
USERTOKEN=$(curl -s -X POST $B/api/auth/register -H "$J" -d "{\"email\":\"smoke$RANDOM@test.com\",\"password\":\"secret1\"}" | jq -r .token)
U="Authorization: Bearer $USERTOKEN"
curl -s $B/api/categories -H "$U" | jq -c '.[] | select(.name=="Smoke Test")'
echo "question count: $(curl -s "$B/api/questions?category=Smoke%20Test&subcategory=Class%2010&subject=History&difficulty=easy" -H "$U" | jq length)  (expected 4)"

say "user data: levels, answers, bookmarks, daily, leaderboard"
QID=$(curl -s "$B/api/questions?category=Smoke%20Test&subcategory=Class%2010&subject=History&difficulty=easy" -H "$U" | jq -r '.[0].id')
D=$(date -u +%F)
echo "level passed (expect 204): $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/me/levels -H "$J" -H "$U" -d '{"category":"Smoke Test","subcategory":"Class 10","subject":"History","difficulty":"hard","levelNumber":1}')"
echo "wrong answer (expect 204): $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/me/answers -H "$J" -H "$U" -d "{\"questionId\":$QID,\"correct\":false}")"
echo "bookmark toggle (expect bookmarked true): $(curl -s -X POST $B/api/me/bookmarks/$QID -H "$U")"
echo "report question (expect 204): $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/me/reports -H "$J" -H "$U" -d "{\"questionId\":$QID,\"reason\":\"typo\",\"note\":\"spelling\"}")"
echo "report again (expect 204, no duplicate): $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/me/reports -H "$J" -H "$U" -d "{\"questionId\":$QID,\"reason\":\"typo\"}")"
echo "report bad reason (expect 400): $(curl -s -o /dev/null -w "%{http_code}" -X POST $B/api/me/reports -H "$J" -H "$U" -d "{\"questionId\":$QID,\"reason\":\"nope\"}")"
echo "settings (expect minAppVersion 1.0.0): $(curl -s $B/api/settings | jq -c '{questionsPerLevel, challengeRounds, minAppVersion}')"
echo "daily complete: $(curl -s -X POST $B/api/me/daily -H "$J" -H "$U" -d "{\"date\":\"$D\",\"score\":7,\"total\":10}")"
echo "my data: $(curl -s $B/api/me/data -H "$U" | jq -c '{levels: (.levels|length), mistakes, bookmarks, stats, daily}')"
echo "daily questions (expect up to 10): $(curl -s "$B/api/daily?date=$D" -H "$U" | jq length)"
echo "leaderboard (expect hard level = 150 points for this user): $(curl -s $B/api/leaderboard -H "$U" | jq -c '.[0]')"

say "normal user must NOT be able to use admin endpoints (expect 403)"
curl -s -o /dev/null -w "%{http_code}\n" -X POST $B/api/admin/categories -H "$J" -H "$U" -d '{"name":"Hack"}'

say "no token must be refused (expect 401)"
curl -s -o /dev/null -w "%{http_code}\n" $B/api/categories

say "cleanup: delete the Smoke Test category"
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE $B/api/admin/categories/$CID -H "$A"

say "admin web pages"
echo "login page (expect 200): $(curl -s -o /dev/null -w "%{http_code}" $B/admin/login)"
echo "dashboard without login (expect 302 redirect to login): $(curl -s -o /dev/null -w "%{http_code}" $B/admin)"

say "admin pages after login (every page must answer 200)"
JAR=$(mktemp)
TOKEN=$(curl -s -c $JAR $B/admin/login | grep -o 'name="__RequestVerificationToken"[^>]*value="[^"]*"' | sed 's/.*value="//;s/"$//')
LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -b $JAR -c $JAR -X POST $B/admin/login \
  --data-urlencode "__RequestVerificationToken=$TOKEN" --data-urlencode "Email=admin@quizin.local" --data-urlencode "Password=Admin@12345")
echo "admin web login (expect 302): $LOGIN"
for P in /admin /admin/content /admin/questions /admin/questions/new /admin/import /admin/import/history /admin/import/template /admin/questions/export /admin/users /admin/reports /admin/settings; do
  echo "$P (expect 200): $(curl -s -o /dev/null -w "%{http_code}" -b $JAR $B$P)"
done
