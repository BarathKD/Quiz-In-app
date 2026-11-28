/*
  ads.js - Rewarded ads (placeholder).
  Export: showRewardedAd. Called by screens that give a reward after an ad (for example extra lives or hints).
  No other file needs to change when real ads are added.
*/

// Rewarded ads. Placeholder until AdMob is added (Phase 4, needs a development build, not Expo Go).
// Resolves true when the user earned the reward (watched the ad), false if they closed it early.
// showRewardedAd(): shows a rewarded ad. Returns a Promise<boolean>.
// Right now it is a placeholder and always returns true (no real ad is shown).
// When AdMob is added, only this function needs to change.
export const showRewardedAd = async () => true;
