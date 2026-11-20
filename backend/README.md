# Quiz-IN backend (ASP.NET Core Web API)

Stack: .NET 8, EF Core 8, SQLite (development) / SQL Server (production), JWT auth, BCrypt passwords.

## Run (GitHub Codespaces or any machine with the .NET SDK)
```
cd backend/QuizIn.Api
dotnet run
```
Development settings (`appsettings.Development.json`) give a dev JWT key and a dev admin
`admin@quizin.local` / `Admin@12345`. The SQLite file `quizin.db` is created on first run.

Test:
```
curl http://localhost:5080/health
curl -X POST http://localhost:5080/api/auth/register -H "Content-Type: application/json" -d '{"email":"a@b.com","password":"secret1"}'
```
(Runs on port 5080 in Development mode via Properties/launchSettings.json.)

## Migrations (recommended once the model is stable)
```
dotnet tool install --global dotnet-ef
dotnet ef migrations add Initial
```
Migrations are provider-specific: delete the `Migrations` folder and recreate it after switching to SQL Server.

## Production (SQL Server)
Set these as environment variables on the host (never commit real secrets):
- `Database__Provider=SqlServer`
- `ConnectionStrings__Default=<Azure SQL connection string>`
- `Jwt__Key=<random string, 32+ characters>`
- `Admin__Email` and `Admin__Password` for the first admin
