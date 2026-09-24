# Receipt eval set (M4.11)

Twenty real receipts that `npm run test:ai-eval` reads through Gemini. A receipt passes when the
total matches to the sen. F4 needs at least 18 of 20.

To add one:

1. Photograph the receipt the way you would in the app: flat, the whole receipt in frame.
2. Save it here as a JPEG (e.g. `01-99-speedmart.jpg`). In iOS Photos, share and choose
   "Save as JPEG", or AirDrop with "All Photos Data" off so it arrives as JPEG.
3. Add an entry to `expected.json`:

   ```json
   { "file": "01-99-speedmart.jpg", "totalSen": 4230 }
   ```

Mix the kinds of receipt Sky actually gets: supermarket (99 Speedmart, Mydin), mamak and hawker,
convenience stores, pharmacy, a faded thermal one, a long one folded, one with rounding
adjustment, one with SST or service charge.

Check each photo before committing it: crop or cover card numbers, names, phone numbers and
loyalty IDs. These files go into the repository.
