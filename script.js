// 1. Firebase Configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyBU_aJf8vE0EGwW5CyGNvoGyl5_Fzn4Ks4",
    authDomain: "the-conscience.firebaseapp.com",
    projectId: "the-conscience",
    storageBucket: "the-conscience.firebasestorage.app",
    messagingSenderId: "131356414869",
    appId: "1:131356414869:web:e665cca0a36d29396cdc9c",
    measurementId: "G-NQJRHCB633"
};

// 2. Initialize Firebase (Uncomment when config is added)
try {
    firebase.initializeApp(firebaseConfig);
} catch (e) {
    console.error("Firebase initialization failed:", e);
    displayError("Could not connect to the database.");
}
const db = firebase.firestore(); // Use compat version

// Determine the current poll ID (replace with your logic if needed, e.g., based on today's date)
const CURRENT_POLL_ID = 'daily_poll_2024-04-21'; 

// 3. DOM Elements
const questionEl = document.getElementById('question');
const optionsEl = document.getElementById('options');
const resultsEl = document.getElementById('results');
const resultsListEl = document.getElementById('results-list');
const totalVotesEl = document.getElementById('total-votes');
const pollContainer = document.getElementById('poll');
const errorMessageEl = document.getElementById('error-message');

// 4. State
let currentPollData = null;
let userVoted = false;

// 5. Functions

function displayError(message) {
    errorMessageEl.textContent = message;
    errorMessageEl.style.display = 'block';
    // Optionally hide the poll/results if error is critical
    // pollContainer.style.display = 'none';
    // resultsEl.style.display = 'none';
}

function loadPoll() {
    // Check local storage first
    if (localStorage.getItem(CURRENT_POLL_ID)) {
        userVoted = true;
    }

    // --- Firebase Fetch Logic ---
    if (!db) {
        displayError("Database connection not established.");
        return;
    }
    console.log(`Attempting to load poll: ${CURRENT_POLL_ID}`); // Debug log
    const pollRef = db.collection('polls').doc(CURRENT_POLL_ID);

    pollRef.get().then((doc) => {
        if (doc.exists) {
            console.log("Poll data received:", doc.data()); // Debug log
            currentPollData = doc.data();
            displayPoll(currentPollData);
            if (userVoted) {
                // If already voted, display results immediately (using the fetched data)
                displayResults();
            }
        } else {
            console.warn(`Poll document '${CURRENT_POLL_ID}' not found.`); // Debug log
            displayError("Today's question could not be found.");
            questionEl.textContent = 'No poll available.';
        }
    }).catch((error) => {
        console.error("Error getting poll: ", error);
        displayError("Error loading the poll data.");
        questionEl.textContent = 'Error loading poll.';
    });
}

function displayPoll(pollData) {
    questionEl.textContent = pollData.question;
    optionsEl.innerHTML = ''; // Clear previous options

    for (const optionText in pollData.options) {
        const button = document.createElement('button');
        button.textContent = optionText;
        button.onclick = () => handleVote(optionText);
        optionsEl.appendChild(button);
    }
}

async function handleVote(option) {
    if (userVoted || !currentPollData) return; // Prevent multiple votes or voting before load

    console.log(`Attempting to vote for: ${option}`); // Debug log

    // Check if the option actually exists in the loaded data
    if (currentPollData.options[option] === undefined) {
        console.error("Attempted to vote for an invalid or non-existent option:", option);
        displayError("Selected option is not valid for this poll.");
        return;
    }

    userVoted = true;
    localStorage.setItem(CURRENT_POLL_ID, option); // Mark as voted locally

    // --- Firebase Update Logic ---
    if (!db) {
        displayError("Database connection not established.");
        // Rollback local state if DB fails before update attempt
        userVoted = false;
        localStorage.removeItem(CURRENT_POLL_ID);
        return;
    }
    const pollRef = db.collection('polls').doc(CURRENT_POLL_ID);
    // Firestore requires FieldValue for increments
    const increment = firebase.firestore.FieldValue.increment(1);

    // Field paths with spaces or special characters need FieldPath
    // Assuming options don't have '.' in them for direct path `options.${option}`
    // If option names might contain '.', use FieldPath: `new firebase.firestore.FieldPath('options', option)`
    const fieldToUpdate = `options.${option}`;

    try {
        // Perform the atomic increment
        await pollRef.update({
            [fieldToUpdate]: increment
        });
        console.log("Vote successfully recorded in Firestore for:", option);

        // Re-fetch data AFTER the update to show the latest results including this vote
        const updatedDoc = await pollRef.get(); 
        if (updatedDoc.exists) {
            currentPollData = updatedDoc.data();
            console.log("Updated poll data after vote:", currentPollData); // Debug log
            displayResults(); // Display the updated results
        } else {
             // This case is unlikely if the update succeeded but handle defensively
             console.error("Poll document disappeared after successful vote update.");
             displayError("Could not refresh results after voting.");
        }
    } catch (error) {
        console.error("Error updating vote in Firestore: ", error);
        displayError("Your vote could not be recorded. Please try again.");
        // Rollback local state on failure
        userVoted = false;
        localStorage.removeItem(CURRENT_POLL_ID);
        // Optionally, re-enable the poll interface
        // pollContainer.style.display = 'block'; 
        // resultsEl.style.display = 'none';
    }
}

function displayResults() {
    if (!currentPollData) return;

    pollContainer.style.display = 'none'; // Hide voting options
    resultsEl.style.display = 'block'; // Show results section
    resultsListEl.innerHTML = ''; // Clear previous results

    let totalVotes = 0;
    for (const option in currentPollData.options) {
        totalVotes += currentPollData.options[option] || 0;
    }

    totalVotesEl.textContent = `Total Votes: ${totalVotes}`;

    // Sort options by votes (descending) for display
    const sortedOptions = Object.entries(currentPollData.options)
        .sort(([, votesA], [, votesB]) => votesB - votesA);

    sortedOptions.forEach(([option, votes]) => {
        const percentage = totalVotes === 0 ? 0 : ((votes / totalVotes) * 100).toFixed(1);
        const li = document.createElement('li');
        const optionSpan = document.createElement('span');
        optionSpan.textContent = option;
        const percentageSpan = document.createElement('span');
        percentageSpan.textContent = `${percentage}% (${votes})`;

        li.appendChild(optionSpan);
        li.appendChild(percentageSpan);
        resultsListEl.appendChild(li);
    });
}

// 6. Initial Load
document.addEventListener('DOMContentLoaded', loadPoll); 