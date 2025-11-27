# Research Paper Citation Database

A static website hosted on GitHub Pages that displays published research papers and allows easy citation downloads. **Strictly limited to peer-reviewed published papers only - no preprints or non-peer-reviewed content.**

## Setup Instructions

### 1. Kaggle Notebook Setup
In your Kaggle notebook, save your data as CSV:
```python
# At the end of your notebook
df.to_csv('/kaggle/working/data.csv', index=False)
```

### 2. Get Public URL
- Make your Kaggle notebook public
- Get the direct download URL for your CSV file
- Format: `https://www.kaggle.com/datasets/[username]/[dataset-name]/download?datasetVersionNumber=[version]`

### 3. Update Configuration
Edit `script.js` and replace `YOUR_KAGGLE_CSV_URL_HERE` with your actual CSV URL.

### 4. Deploy to GitHub Pages
1. Push this repository to GitHub
2. Go to Settings → Pages
3. Select "Deploy from a branch"
4. Choose "main" branch and "/ (root)" folder
5. Your site will be available at `https://[username].github.io/[repository-name]`

## Features
- Automatic paper data fetching from Kaggle
- One-click BibTeX citation downloads
- Published papers only (no preprints)
- Responsive design for mobile/desktop
- Error handling and loading states
- Paper statistics by year
- DOI links for verification
- Manual refresh capability

## CORS Considerations
If you encounter CORS issues, consider:
1. Using Kaggle's public dataset URLs
2. Setting up a simple proxy service
3. Using GitHub Actions to periodically fetch and commit data