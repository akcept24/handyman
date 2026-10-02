# Meta Pixel setup (owner step, 5 minutes)

Code already supports the Pixel: `tracking.config.js` loads it only when
`facebookPixelId` is a real ID (today it is the `XXXXXXXXXXXXXXX` placeholder,
so Meta ads currently see zero leads).

1. Open Meta Events Manager with the business Facebook account.
2. Create a data source: Web → name it `California Handymen Website`.
3. Copy the numeric Pixel ID (15–16 digits).
4. Send the ID to Muse; it goes into `tracking.config.js`
   (`facebookPixelId`) in one small deploy. No other code change is needed:
   the `Lead` event already fires only after confirmed lead delivery.
5. Verify in Events Manager → Test Events after the deploy: submit a test
   estimate request and confirm the `Lead` event arrives.
