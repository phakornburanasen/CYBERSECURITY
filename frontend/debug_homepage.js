// Debug script to check HomePage state
console.log('=== HomePage Debug ===');
console.log('Search term:', document.querySelector('.search-input')?.value);
console.log('Filter type:', document.querySelector('.filter-select')?.value);
console.log('Filtered logs count:', document.querySelectorAll('.log-card')?.length);
console.log('Total logs in state:', window.filteredLogsCount || 'Not available');

// Check if search section exists
const searchSection = document.querySelector('.search-filter-section');
if (searchSection) {
  console.log('Search section found:', searchSection.style.display);
  console.log('Search section classes:', searchSection.className);
} else {
  console.log('Search section NOT found');
}

// Check if logs container exists
const logsContainer = document.querySelector('.logs-container');
if (logsContainer) {
  console.log('Logs container found:', logsContainer.style.display);
  console.log('Logs grid found:', document.querySelector('.logs-grid')?.length);
} else {
  console.log('Logs container NOT found');
}

console.log('=== End Debug ===');
