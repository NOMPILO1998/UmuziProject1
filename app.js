
let globalData = null;
let myLineChart = null;
let myBarChart = null;

// HTML elements
const countrySelect = document.getElementById('countrySelect');
const startDate = document.getElementById('startDate');
const endDate = document.getElementById('endDate');


// 1. Load COVID-19 JSON data
async function loadCovidData() {

    try {

        const response = await fetch('./covid-19.json');

        if (!response.ok) {
            throw new Error('Unable to load JSON file: ' + response.status);
        }

        globalData = await response.json();

        if (!Array.isArray(globalData.countries)) {
            throw new Error('Invalid JSON structure.');
        }

        // Display source and period
        document.getElementById('datasetSource').textContent =
            'Source: ' + globalData.source;

        document.getElementById('datasetPeriod').textContent =
            'Dataset period: ' + globalData.period;

        // Populate dropdown
        populateCountryDropdown(globalData);

        console.log('COVID-19 data successfully loaded.');

    } catch (error) {

        console.error(error);

        document.getElementById('insights').textContent =
            'Unable to load the dataset. Check your JSON file and Chart.js library.';

    }
}


// 2. Populate country dropdown
function populateCountryDropdown(data) {

    countrySelect.innerHTML =
        '<option value="">Select a country</option>';

    data.countries.forEach(country => {

        const option = document.createElement('option');

        option.value = country.country;
        option.textContent = country.country;

        countrySelect.appendChild(option);

    });

}


// 3. Reset statistics
function resetDashboard(message) {

    document.getElementById('confirmedCases').textContent = '-';
    document.getElementById('deathCases').textContent = '-';
    document.getElementById('recoveredCases').textContent = '-';
    document.getElementById('activeCases').textContent = '-';

    document.getElementById('insights').textContent = message;

    if (myLineChart) {
        myLineChart.destroy();
        myLineChart = null;
    }

    if (myBarChart) {
        myBarChart.destroy();
        myBarChart = null;
    }

}


// 4. Handle country selection
function selectCountry(countryName) {

    if (!countryName) {
        resetDashboard('Select a country to explore the COVID-19 outbreak.');
        return;
    }

    const countryObj = globalData.countries.find(
        item => item.country === countryName
    );

    if (!countryObj || !countryObj.data.length) {
        resetDashboard('No data available for this country.');
        return;
    }

    // Find date limits for selected country
    const dates = countryObj.data.map(item => item.date).sort();

    startDate.min = dates[0];
    startDate.max = dates[dates.length - 1];

    endDate.min = dates[0];
    endDate.max = dates[dates.length - 1];

    // Initially show the full available period
    startDate.value = dates[0];
    endDate.value = dates[dates.length - 1];

    updateDashboard();
}


// 5. Update dashboard using selected dates
function updateDashboard() {

    if (!globalData || !countrySelect.value) return;

    const countryObj = globalData.countries.find(
        item => item.country === countrySelect.value
    );

    if (!countryObj) return;

    const from = startDate.value;
    const to = endDate.value;

    if (from && to && from > to) {

        resetDashboard('The start date cannot be after the end date.');
        return;

    }

    // Sort data by date
    const allData = [...countryObj.data].sort(
        (a, b) => a.date.localeCompare(b.date)
    );

    // Get observations within the selected range
    const filteredData = allData.filter(
        item => item.date >= from && item.date <= to
    );

    if (filteredData.length === 0) {

        resetDashboard('No reported data is available within this date range.');
        return;

    }

    // Get latest available observation in the selected range
    const latest = filteredData[filteredData.length - 1];

    const confirmed = Number(latest.confirmed) || 0;
    const deaths = Number(latest.deaths) || 0;
    const recovered = Number(latest.recovered) || 0;

    const active = confirmed - deaths - recovered;


    // 6. Display statistics
    document.getElementById('confirmedCases').textContent =
        confirmed.toLocaleString();

    document.getElementById('deathCases').textContent =
        deaths.toLocaleString();

    document.getElementById('recoveredCases').textContent =
        recovered.toLocaleString();

    document.getElementById('activeCases').textContent =
        active.toLocaleString();


    // 7. Update charts
    updateLineChart(filteredData);

    updateBarChart(allData, from, to);

    // 8. Update insights
    updateInsights(countryObj.country, filteredData);

}


// 9. Cumulative cases line chart
function updateLineChart(data) {

    if (myLineChart) {
        myLineChart.destroy();
    }

    const dates = data.map(item => item.date);

    const confirmed = data.map(item => Number(item.confirmed) || 0);

    const deaths = data.map(item => Number(item.deaths) || 0);

    const recovered = data.map(item => Number(item.recovered) || 0);


    myLineChart = new Chart(
        document.getElementById('lineChart'),
        {

            type: 'line',

            data: {

                labels: dates,

                datasets: [

                    {
                        label: 'Confirmed Cases',
                        data: confirmed,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52,152,219,0.10)',
                        tension: 0.3,
                        fill: false
                    },

                    {
                        label: 'Deaths',
                        data: deaths,
                        borderColor: '#e74c3c',
                        backgroundColor: 'rgba(231,76,60,0.10)',
                        tension: 0.3,
                        fill: false
                    },

                    {
                        label: 'Recoveries',
                        data: recovered,
                        borderColor: '#2ecc71',
                        backgroundColor: 'rgba(46,204,113,0.10)',
                        tension: 0.3,
                        fill: false
                    }

                ]

            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                interaction: {
                    intersect: false,
                    mode: 'index'
                },

                plugins: {

                    legend: {
                        position: 'top'
                    }

                },

                scales: {

                    y: {
                        beginAtZero: true
                    }

                }

            }

        }
    );

}


// 10. Average new cases per day bar chart
function updateBarChart(allData, from, to) {

    if (myBarChart) {
        myBarChart.destroy();
    }

    // Include the previous observation as a baseline
    // when the selected range starts between reports.
    const observations = allData.filter(item => item.date <= to);

    const labels = [];
    const dailyAverages = [];

    for (let i = 1; i < observations.length; i++) {

        const current = observations[i];
        const previous = observations[i - 1];

        // Only show intervals ending inside selected range
        if (current.date < from) continue;

        const currentConfirmed = Number(current.confirmed) || 0;
        const previousConfirmed = Number(previous.confirmed) || 0;

        const difference = currentConfirmed - previousConfirmed;

        const date1 = new Date(previous.date + 'T00:00:00Z');
        const date2 = new Date(current.date + 'T00:00:00Z');

        const days = Math.round(
            (date2 - date1) / (1000 * 60 * 60 * 24)
        );

        if (days > 0) {

            labels.push(current.date);

            dailyAverages.push(
                Math.max(0, difference) / days
            );

        }

    }


    myBarChart = new Chart(
        document.getElementById('barChart'),
        {

            type: 'bar',

            data: {

                labels: labels,

                datasets: [{

                    label: 'Average New Confirmed Cases Per Day',

                    data: dailyAverages,

                    backgroundColor: [
    '#8B5CF6',
    '#7C3AED',
    '#6D28D9',
    '#A78BFA',
    '#9333EA',
    '#C084FC'
],

                    borderRadius: 8,
                    borderSkipped: false,
                    hoverBackgroundColor: '#4C1D95'

                }]

            },

            options: {

                responsive: true,
                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {

                        callbacks: {

                            label: function(context) {

                                return 'Average: ' +
                                    context.raw.toLocaleString(
                                        undefined,
                                        { maximumFractionDigits: 2 }
                                    ) +
                                    ' cases per day';

                            }

                        }

                    }

                },

                scales: {

                    y: {
                        beginAtZero: true,

                        title: {
                            display: true,
                            text: 'Average cases per day'
                        }

                    }

                }

            }

        }
    );

}


// 11. Generate data insights
function updateInsights(country, data) {

    const first = data[0];
    const latest = data[data.length - 1];

    const confirmed = Number(latest.confirmed) || 0;
    const deaths = Number(latest.deaths) || 0;
    const recovered = Number(latest.recovered) || 0;

    const active = confirmed - deaths - recovered;

    const increase =
        confirmed - (Number(first.confirmed) || 0);

    let growthMessage = '';

    if (increase > 0) {

        growthMessage = `Confirmed cases increased by ${increase.toLocaleString()} between the first and last reported observations in this selected period.`;

    } else if (increase === 0) {

        growthMessage = 'There was no increase in confirmed cases between the first and last reported observations in this selected period.';

    } else {

        growthMessage = 'Confirmed cases decreased between the first and last reported observations in this selected period.';

    }

    document.getElementById('insights').innerHTML = `

        <p>
            <strong>${country}</strong> recorded
            <strong>${confirmed.toLocaleString()}</strong>
            confirmed COVID-19 cases as of ${latest.date}.
        </p>

        <p>${growthMessage}</p>

        <p>
            There were
            <strong>${deaths.toLocaleString()}</strong> deaths,
            <strong>${recovered.toLocaleString()}</strong> recoveries
            and <strong>${active.toLocaleString()}</strong> active cases.
        </p>

        <p>
            The dashboard displays ${data.length}
            reported observations within the selected date range.
        </p>

    `;

}


// 12. Event listeners
countrySelect.addEventListener('change', function() {

    selectCountry(this.value);

});

startDate.addEventListener('change', updateDashboard);

endDate.addEventListener('change', updateDashboard);


// 13. Start dashboard
loadCovidData();
