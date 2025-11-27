class CitationDashboard {
    constructor() {
        this.paperDoi = "10.48550/arXiv.2309.08532"; // Default paper DOI
        this.mailto = "s3890442@student.rmit.edu.au"; // Replace with your email
        this.cacheKey = `citations_${this.paperDoi}`;
        this.init();
    }

    init() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadCitations(true));
        this.loadCitations(false);
    }

    async loadCitations(forceRefresh = false) {
        this.showLoading();
        
        try {
            // Check cache first unless force refresh
            if (!forceRefresh) {
                const cached = localStorage.getItem(this.cacheKey);
                if (cached) {
                    const data = JSON.parse(cached);
                    this.displayData(data);
                    return;
                }
            }
            
            // First get the paper info
            const paperInfo = await this.getPaperInfo(this.paperDoi);
            const shortId = paperInfo.id.split('/').pop();
            
            // Then get all citing works
            const citingWorks = await this.getCitingWorks(shortId);
            
            const data = this.formatCitationData(citingWorks);
            
            // Cache the result
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
            
            this.displayData(data);
        } catch (error) {
            console.error('Error loading citations:', error);
            this.showError(`Failed to load citations: ${error.message}`);
        }
    }

    async getPaperInfo(doi) {
        const url = `https://api.openalex.org/works/doi:${doi}`;
        const response = await fetch(`${url}?mailto=${this.mailto}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    }

    async getCitingWorks(shortWorkId) {
        const allWorks = [];
        let cursor = '*';
        
        while (cursor) {
            const url = 'https://api.openalex.org/works';
            const params = new URLSearchParams({
                filter: `cites:${shortWorkId}`,
                per_page: 200,
                cursor: cursor,
                mailto: this.mailto
            });
            
            const response = await fetch(`${url}?${params}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const page = await response.json();
            allWorks.push(...page.results);
            
            cursor = page.meta?.next_cursor;
            
            // Add small delay to be nice to the API
            if (cursor) await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return allWorks;
    }

    formatCitationData(citingWorks) {
        const headers = ['year', 'title', 'doi', 'link'];
        const rows = citingWorks.map(work => {
            const year = work.publication_year || 'Unknown';
            const title = work.display_name || 'Untitled';
            const rawDoi = work.doi || '';
            const doi = rawDoi.replace('https://doi.org/', '');
            
            let link;
            if (doi) {
                link = `https://doi.org/${doi}`;
            } else {
                const primaryLocation = work.primary_location || {};
                link = primaryLocation.landing_page_url || work.id;
            }
            
            return { year, title, doi, link };
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
            <h3>Citation Analysis for ${this.paperDoi}</h3>
            <p><strong>Total Citations:</strong> ${data.rows.length}</p>
            <p><strong>Years:</strong> ${Object.keys(yearCounts).sort().join(', ')}</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
            <p><em>Data source: OpenAlex API - Peer-reviewed publications only</em></p>
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
            th.textContent = header.charAt(0).toUpperCase() + header.slice(1);
            headerRow.appendChild(th);
        });
        const actionTh = document.createElement('th');
        actionTh.textContent = 'Actions';
        headerRow.appendChild(actionTh);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Body with citation buttons
        const tbody = document.createElement('tbody');
        data.rows.forEach(row => {
            const tr = document.createElement('tr');
            data.headers.forEach(header => {
                const td = document.createElement('td');
                if (header === 'link' && row[header]) {
                    td.innerHTML = `<a href="${row[header]}" target="_blank">View Paper</a>`;
                } else {
                    td.textContent = row[header] || '';
                }
                tr.appendChild(td);
            });
            
            // Action column
            const actionTd = document.createElement('td');
            actionTd.innerHTML = `<button class="citation-btn" onclick="downloadCitation('${row.doi}', '${row.title.replace(/'/g, "\\'").replace(/"/g, '&quot;')}', '${row.year}')">Download BibTeX</button>`;
            tr.appendChild(actionTd);
            
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);

        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
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
    // Generate a clean citation key
    const cleanDoi = doi ? doi.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    const citationKey = `${cleanDoi}_${year}`;
    
    // Create BibTeX citation
    let citation = `@article{${citationKey},
  title={${title}},
  year={${year}}`;
    
    if (doi) {
        citation += `,
  doi={${doi}},
  url={https://doi.org/${doi}}`;
    }
    
    citation += '\n}';
    
    // Download the citation
    const blob = new Blob([citation], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `citation_${cleanDoi}.bib`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CitationDashboard();
});