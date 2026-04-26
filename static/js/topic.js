// static/js/topic.js

let allTopics = {};
let selectedDomain = null;

/**
 * Loads topics from the JSON database
 */
export async function loadTopics() {
    try {
        const response = await fetch('/static/data/sentences.json');
        if (!response.ok) throw new Error('Failed to load sentences.json');
        allTopics = await response.json();
        console.log("Topics loaded successfully");
    } catch (error) {
        console.error("Error loading topics:", error);
    }
}

/**
 * Sets the current domain and returns the associated topics
 */
export function setDomain(domain) {
    selectedDomain = domain;
    return allTopics[domain] || [];
}

export function getSelectedDomain() {
    return selectedDomain;
}

/**
 * Returns a random topic from the currently selected domain
 */
export function getRandomTopic() {
    if (!selectedDomain || !allTopics[selectedDomain]) return "Please select a domain first!";
    const topics = allTopics[selectedDomain];
    const randomIndex = Math.floor(Math.random() * topics.length);
    return topics[randomIndex];
}
