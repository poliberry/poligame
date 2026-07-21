# SteamGridDB API Setup

This application uses the SteamGridDB API to fetch high-quality game artwork (grid covers, logos, and header images).

## Getting an API Key

1. Create an account on [SteamGridDB](https://www.steamgriddb.com/)
2. Navigate to your [Profile Preferences](https://www.steamgriddb.com/profile/preferences)
3. Generate an API key

## Setting Up the API Key

1. Create a `.env` file in the `src-tauri` directory (this directory)
2. Add the following line to the `.env` file:

```
STEAMGRIDDB_API_KEY=your_api_key_here
```

Replace `your_api_key_here` with your actual API key from SteamGridDB.

## Example .env file

```
STEAMGRIDDB_API_KEY=abc123xyz789
```

## Note

- The `.env` file is ignored by git (it's in .gitignore) so your API key won't be committed
- If you don't set an API key, the application will still work but may have rate limits or reduced functionality
- The API key is only used when fetching images from SteamGridDB during game scanning

