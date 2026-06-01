let currentBooksData = [];
let targetUploadImg = null; 
let targetUploadFallback = null;
const BOOKS_PER_PAGE = 18; 

document.getElementById('csvFileInput').addEventListener('change', handleFile);
document.getElementById('readOnlyToggle').addEventListener('change', renderShelf);
document.getElementById('multipleExportToggle').addEventListener('change', renderShelf);

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            currentBooksData = results.data;
            renderShelf();
        }
    });
}

function renderShelf() {
    const container = document.getElementById('frame-container');
    container.innerHTML = ''; 

    if (currentBooksData.length === 0) return;

    let validBooks = [];
    currentBooksData.forEach(book => {
        let isbn = book.ISBN13 || book.ISBN || "";
        isbn = isbn.replace(/[^0-9X]/g, '');
        if (isbn) {
            book.cleanIsbn = isbn; 
            validBooks.push(book);
        }
    });

    if (document.getElementById('readOnlyToggle').checked) {
        validBooks = validBooks.filter(book => book['Exclusive Shelf'] === 'read');
    }

    const isMultiple = document.getElementById('multipleExportToggle').checked;
    const chunkSize = isMultiple ? BOOKS_PER_PAGE : validBooks.length;

    for (let i = 0; i < validBooks.length; i += chunkSize) {
        const chunk = validBooks.slice(i, i + chunkSize);
        createPage(chunk, (i / chunkSize) + 1);
    }

    if (validBooks.length > 0) {
        document.getElementById('exportBtn').style.display = 'inline-block';
    }
}

function createPage(books, pageNum) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'frame-page';
    pageDiv.id = `frame-page-${pageNum}`;

    const bookshelf = document.createElement('div');
    bookshelf.className = 'bookshelf';

    books.forEach(book => {
        const wrapper = document.createElement('div');
        wrapper.className = 'book-wrapper';
        wrapper.title = book.Title; 

        const img = document.createElement('img');
        img.className = 'book-cover';
        img.src = `https://covers.openlibrary.org/b/isbn/${book.cleanIsbn}-L.jpg`;
        img.crossOrigin = "anonymous";

        const applyFallback = () => {
            img.style.display = 'none'; 
            
            const fallback = document.createElement('div');
            fallback.className = 'fallback-cover';
            
            const titleSpan = document.createElement('span');
            titleSpan.innerText = book.Title;
            
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'fallback-actions';

            // RESTORED: Open Library Search API
            const searchBtn = document.createElement('button');
            searchBtn.className = 'upload-btn';
            searchBtn.innerText = 'Find Cover';
            searchBtn.onclick = async () => {
                searchBtn.innerText = 'Searching...';
                try {
                    // Clean the title to strip out series info in parentheses
                    const cleanTitle = book.Title.replace(/\s*\(.*?\)\s*/g, '').trim();
                    const query = encodeURIComponent(`${cleanTitle} ${book.Author}`);
                    
                    // Ping Open Library Search API
                    const response = await fetch(`https://openlibrary.org/search.json?q=${query}`);
                    const data = await response.json();

                    // Search the results for the first edition that actually has a cover image ID
                    const docWithCover = data.docs && data.docs.find(doc => doc.cover_i);

                    if (docWithCover) {
                        const newCoverUrl = `https://covers.openlibrary.org/b/id/${docWithCover.cover_i}-L.jpg`;
                        
                        img.src = newCoverUrl;
                        img.onload = () => {
                            img.style.display = 'block';
                            fallback.remove();
                        };
                    } else {
                        console.log(`No cover found in Open Library for: "${cleanTitle}" by ${book.Author}`); 
                        searchBtn.innerText = 'Not Found';
                        setTimeout(() => searchBtn.innerText = 'Find Cover', 2000);
                    }
                } catch (error) {
                    console.error("Open Library API Error:", error);
                    searchBtn.innerText = 'Error';
                    setTimeout(() => searchBtn.innerText = 'Find Cover', 2000);
                }
            };
            
            // Manual Upload Button
            const uploadBtn = document.createElement('button');
            uploadBtn.className = 'upload-btn';
            uploadBtn.innerText = 'Upload';
            uploadBtn.onclick = () => {
                targetUploadImg = img;
                targetUploadFallback = fallback;
                document.getElementById('manualCoverUpload').click();
            };

            actionsDiv.appendChild(searchBtn);
            actionsDiv.appendChild(uploadBtn);
            fallback.appendChild(titleSpan);
            fallback.appendChild(actionsDiv);
            wrapper.appendChild(fallback);
        };

        img.onerror = applyFallback;

        img.onload = function() {
            if (img.naturalWidth <= 1) {
                applyFallback();
            }
        };

        wrapper.appendChild(img);
        bookshelf.appendChild(wrapper);
    });

    pageDiv.appendChild(bookshelf);
    document.getElementById('frame-container').appendChild(pageDiv);
}

document.getElementById('manualCoverUpload').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file || !targetUploadImg) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        targetUploadImg.src = event.target.result;
        targetUploadImg.style.display = 'block';
        
        if (targetUploadFallback) {
            targetUploadFallback.remove();
        }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
});

document.getElementById('exportBtn').addEventListener('click', async function() {
    const pages = document.querySelectorAll('.frame-page');
    const overlay = document.getElementById('progressOverlay');
    const progressText = document.getElementById('progressText');
    
    overlay.style.display = 'flex'; 
    
    for (let i = 0; i < pages.length; i++) {
        progressText.innerText = `Downloading page ${i + 1} of ${pages.length}...`;
        await new Promise(resolve => setTimeout(resolve, 100)); 

        const canvas = await html2canvas(pages[i], { useCORS: true, scale: 2 });
        const image = canvas.toDataURL("image/jpeg", 1.0);
        
        const link = document.createElement('a');
        link.download = `bookshelf-page-${i + 1}.jpg`;
        link.href = image;
        link.click();
        
        await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    progressText.innerText = "Done!";
    setTimeout(() => {
        overlay.style.display = 'none'; 
    }, 1500);
}); 

// --- NEW TUTORIAL MODAL LOGIC ---

const tutorialModal = document.getElementById('tutorialModal');
const tutorialBtn = document.getElementById('tutorialBtn');
const closeTutorialBtn = document.getElementById('closeTutorialBtn');

// Open the modal
tutorialBtn.addEventListener('click', function() {
    tutorialModal.style.display = 'flex';
});

// Close the modal when clicking the X
closeTutorialBtn.addEventListener('click', function() {
    tutorialModal.style.display = 'none';
});

// Close the modal when clicking outside the white box
window.addEventListener('click', function(event) {
    if (event.target === tutorialModal) {
        tutorialModal.style.display = 'none';
    }
});