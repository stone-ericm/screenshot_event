#!/usr/bin/env node
/**
 * Open the confirm form with test data
 * Usage: node scripts/test-form.js [multi]
 */

import { exec } from 'child_process';

const singleEvent = [{
  title: "Test Event",
  date: "2025-12-25",
  startTime: "14:00",
  endTime: "",
  location: "123 Main St",
  description: "Test description"
}];

const multiEvent = [
  {
    title: "Day 1 Event",
    date: "2025-12-25",
    startTime: "10:00",
    endTime: "18:00",
    location: "Venue"
  },
  {
    title: "Day 2 Event",
    date: "2025-12-26",
    startTime: "10:00",
    endTime: "18:00",
    location: "Venue"
  }
];

const isMulti = process.argv[2] === 'multi';
const events = isMulti ? multiEvent : singleEvent;

const params = new URLSearchParams({
  prefilled: '1',
  events: JSON.stringify(events)
});

// Use production URL by default, localhost with --local flag
const useLocal = process.argv.includes('--local');
const baseUrl = useLocal ? 'http://localhost:3000' : 'https://screenshot-event-app.vercel.app';
const url = `${baseUrl}/confirm.html?${params.toString()}`;

console.log('Opening:', url);
exec(`open "${url}"`);
