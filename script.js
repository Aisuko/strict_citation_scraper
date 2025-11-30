class CitationDashboard {
    constructor() {
        this.paperDoi = "10.48550/arXiv.2309.08532"; // Default paper DOI
        this.mailto = "s3890442@student.rmit.edu.au"; // Replace with your email
        this.cacheKey = `citations_${this.paperDoi}`;
        this.init();
    }

    init() {
        document.getElementById('refreshBtn').addEventListener('click', () => this.loadCitations(true));
        document.getElementById('searchBox').addEventListener('input', (e) => this.filterTable(e.target.value));
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
            
            // Fetch from both APIs in parallel
            const [openAlexCitations, semanticScholarCitations] = await Promise.all([
                this.getOpenAlexCitations(),
                this.getSemanticScholarCitations()
            ]);
            
            const data = this.mergeCitations(openAlexCitations, semanticScholarCitations);
            
            // Cache the result
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
            
            this.displayData(data);
        } catch (error) {
            console.error('Error loading citations:', error);
            this.showError(`Failed to load citations: ${error.message}`);
        }
    }

    async getOpenAlexCitations() {
        // First get the paper info
        const url = `https://api.openalex.org/works/doi:${this.paperDoi}`;
        const response = await fetch(`${url}?mailto=${this.mailto}`);
        if (!response.ok) throw new Error(`OpenAlex HTTP ${response.status}`);
        const paperInfo = await response.json();
        const shortId = paperInfo.id.split('/').pop();
        
        // Then get all citing works
        const allWorks = [];
        let cursor = '*';
        
        while (cursor) {
            const worksUrl = 'https://api.openalex.org/works';
            const params = new URLSearchParams({
                filter: `cites:${shortId}`,
                per_page: 200,
                cursor: cursor,
                mailto: this.mailto
            });
            
            const worksResponse = await fetch(`${worksUrl}?${params}`);
            if (!worksResponse.ok) throw new Error(`OpenAlex HTTP ${worksResponse.status}`);
            
            const page = await worksResponse.json();
            allWorks.push(...page.results);
            
            cursor = page.meta?.next_cursor;
            
            // Add small delay to be nice to the API
            if (cursor) await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return allWorks;
    }

    async getSemanticScholarCitations() {
        try {
            const url = `https://api.semanticscholar.org/graph/v1/paper/DOI:${this.paperDoi}/citations`;
            const params = new URLSearchParams({
                fields: 'title,year,authors,venue,publicationTypes,publicationDate,citationCount,influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy,s2FieldsOfStudy,publicationVenue,externalIds',
                limit: 1000
            });
            
            const response = await fetch(`${url}?${params}`);
            if (!response.ok) throw new Error(`Semantic Scholar HTTP ${response.status}`);
            
            const data = await response.json();
            return data.data || [];
        } catch (error) {
            console.warn('Semantic Scholar API failed:', error.message);
            return [];
        }
    }

    mergeCitations(openAlexWorks, semanticScholarWorks) {
        const headers = ['year', 'title', 'doi', 'link', 'status', 'source'];
        const citationMap = new Map();
        
        // Process OpenAlex citations
        openAlexWorks.forEach(work => {
            const rawDoi = work.doi || '';
            const doi = rawDoi.replace('https://doi.org/', '');
            const key = doi || work.display_name;
            
            if (key) {
                citationMap.set(key, {
                    year: work.publication_year || '-',
                    title: work.display_name || 'Untitled',
                    doi: doi,
                    link: doi ? `https://doi.org/${doi}` : (work.primary_location?.landing_page_url || work.id),
                    status: 'Peer-reviewed',
                    source: 'OpenAlex'
                });
            }
        });
        
        // Process Semantic Scholar citations
        semanticScholarWorks.forEach(item => {
            const work = item.citingPaper;
            if (!work) return;
            
            const doi = work.externalIds?.DOI || '';
            const key = doi || work.title;
            
            if (key) {
                const isPreprint = work.publicationTypes?.includes('Preprint') || 
                                 work.venue?.toLowerCase().includes('arxiv') ||
                                 work.publicationVenue?.name?.toLowerCase().includes('arxiv');
                
                const existing = citationMap.get(key);
                if (existing) {
                    // Update source to show both
                    existing.source = 'OpenAlex + Semantic Scholar';
                } else {
                    citationMap.set(key, {
                        year: work.year || '-',
                        title: work.title || 'Untitled',
                        doi: doi,
                        link: doi ? `https://doi.org/${doi}` : `https://www.semanticscholar.org/paper/${work.paperId}`,
                        status: isPreprint ? 'Pre-print' : 'Peer-reviewed',
                        source: 'Semantic Scholar'
                    });
                }
            }
        });
        
        const rows = Array.from(citationMap.values());
        return { headers, rows };
    }

    displayData(data) {
        this.hideLoading();
        this.allData = data; // Store for filtering
        this.showStats(data);
        this.showTable(data);
        document.getElementById('dataSection').classList.remove('hidden');
    }

    showStats(data) {
        const stats = document.getElementById('dataStats');
        const yearCounts = this.getYearCounts(data.rows);
        const statusCounts = this.getStatusCounts(data.rows);
        
        stats.innerHTML = `
            <h3>Citation Analysis for ${this.paperDoi}</h3>
            <p><strong>Total Citations:</strong> ${data.rows.length}</p>
            <p><strong>Peer-reviewed:</strong> ${statusCounts['Peer-reviewed'] || 0} | <strong>Pre-prints:</strong> ${statusCounts['Pre-print'] || 0}</p>
            <p><strong>Years:</strong> ${Object.keys(yearCounts).sort().join(', ')}</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
            <p><em>Data sources: OpenAlex API + Semantic Scholar API</em></p>
        `;
    }

    getYearCounts(rows) {
        return rows.reduce((acc, row) => {
            const year = row.year || '-';
            acc[year] = (acc[year] || 0) + 1;
            return acc;
        }, {});
    }

    getStatusCounts(rows) {
        return rows.reduce((acc, row) => {
            const status = row.status || 'Unknown';
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, {});
    }

    filterTable(searchTerm) {
        if (!this.allData) return;
        
        const filteredRows = this.allData.rows.filter(row => 
            row.title.toLowerCase().includes(searchTerm.toLowerCase())
        );
        
        const filteredData = {
            headers: this.allData.headers,
            rows: filteredRows
        };
        
        this.showTable(filteredData);
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
                } else if (header === 'status') {
                    td.textContent = row[header] || '';
                    td.className = row[header] === 'Pre-print' ? 'preprint' : 'peer-reviewed';
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