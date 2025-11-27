class DataDashboard {
    constructor() {
        // Try multiple URLs in case of CORS issues
        this.dataUrls = [
            'https://www.kaggle.com/api/v1/datasets/download/aisuko/a-strict-citation-scraper/data.csv',
            'https://raw.githubusercontent.com/aisuko/strict_citation_scraper/main/data.csv' // Fallback if you commit CSV to GitHub
        ];
        this.dataUrl = this.dataUrls[0];
        this.init();
    }

    init() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadData());
        this.loadData();
    }

    async loadData() {
        this.showLoading();
        
        // Try each URL until one works
        for (const url of this.dataUrls) {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                
                const csvText = await response.text();
                const data = this.parseCSV(csvText);
                this.displayData(data);
                return; // Success, exit the loop
            } catch (error) {
                console.log(`Failed to load from ${url}:`, error.message);
                continue; // Try next URL
            }
        }
        
        // If all URLs failed
        this.showError('Failed to load data from all sources. Please check if the dataset is public and accessible.');
    }

    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => {
            const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index] || '';
                return obj;
            }, {});
        });
        return { headers, rows };
    }

    displayData(data) {
        this.hideLoading();
        this.showStats(data);
        this.showTable(data);
        document.getElementById('dataSection').classList.remove('hidden');
    }

    showStats(data) {
        const stats = document.getElementById('dataStats');
        const yearCounts = this.getYearCounts(data.rows);
        stats.innerHTML = `
            <h3>Published Papers Overview</h3>
            <p><strong>Total Papers:</strong> ${data.rows.length}</p>
            <p><strong>Years:</strong> ${Object.keys(yearCounts).join(', ')}</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
            <p><em>Note: This database contains only peer-reviewed published papers, excluding preprints and non-peer-reviewed content.</em></p>
        `;
    }

    getYearCounts(rows) {
        return rows.reduce((acc, row) => {
            const year = row.year || 'Unknown';
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {});
    }

    showTable(data) {
        const tableContainer = document.getElementById('dataTable');
        const table = document.createElement('table');
        
        // Headers
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        data.headers.forEach(header => {
            const th = document.createElement('th');
            th.textContent = header;
            headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body with citation buttons
        const tbody = document.createElement('tbody');
        data.rows.slice(0, 100).forEach(row => {
            const tr = document.createElement('tr');
            data.headers.forEach(header => {
                const td = document.createElement('td');
                if (header === 'title') {
                    td.innerHTML = `
                        ${row[header] || ''}
                        <br><button class="citation-btn" onclick="downloadCitation('${row.doi}', '${row.title}', '${row.year}')">Download Citation</button>
                    `;
                } else {
                    td.textContent = row[header] || '';
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);

        if (data.rows.length > 100) {
            const notice = document.createElement('p');
            notice.textContent = `Showing first 100 of ${data.rows.length} records`;
            notice.style.padding = '1rem';
            notice.style.fontStyle = 'italic';
            tableContainer.appendChild(notice);
        }
    }

    showLoading() {
        document.getElementById('loading').classList.remove('hidden');
        document.getElementById('error').classList.add('hidden');
        document.getElementById('dataSection').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    showError(message) {
        this.hideLoading();
        const errorDiv = document.getElementById('error');
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

// Citation download function
function downloadCitation(doi, title, year) {
    const citation = `@article{${doi.replace(/[^a-zA-Z0-9]/g, '_')}_${year},
  title={${title}},
  year={${year}},
  doi={${doi}},
  url={https://doi.org/${doi}}
}`;
    
    const blob = new Blob([citation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citation_${doi.replace(/[^a-zA-Z0-9]/g, '_')}.bib`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DataDashboard();
});