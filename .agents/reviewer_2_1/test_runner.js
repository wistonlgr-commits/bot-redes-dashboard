const fs = require('fs');

function parseTimeTo24hHour(raw) {
    if (!raw) return null;
    const str = raw.toString().toLowerCase().trim();
    if (!str) return null;

    const isPM = str.includes('pm');
    const isAM = str.includes('am');

    const clean = str.replace(/(am|pm)/g, '').trim();
    const parts = clean.split(':');
    if (parts.length === 0) return null;

    let h = parseInt(parts[0], 10);
    if (isNaN(h)) return null;

    if (isPM) {
        if (h < 12) h += 12;
    } else if (isAM) {
        if (h === 12) h = 0;
    }

    if (h >= 0 && h <= 23) {
        return h;
    }
    return null;
}

const testCases = [
    { input: '04:00 pm', expected: 16 },
    { input: '4:00 pm', expected: 16 },
    { input: '04:00 PM', expected: 16 },
    { input: '04:00 am', expected: 4 },
    { input: '12:00 pm', expected: 12 },
    { input: '12:00 am', expected: 0 },
    { input: '08:00', expected: 8 },
    { input: '16:00', expected: 16 },
    { input: '17:00', expected: 17 },
    { input: '09:30 am', expected: 9 },
    { input: '4 pm', expected: 16 },
    { input: '11:00 am', expected: 11 },
];

let allPassed = true;
testCases.forEach(tc => {
    const res = parseTimeTo24hHour(tc.input);
    const pass = res === tc.expected;
    if (!pass) allPassed = false;
    console.log(`Input: '${tc.input}' => Got: ${res}, Expected: ${tc.expected} [${pass ? 'PASS' : 'FAIL'}]`);
});

console.log('Parse test result:', allPassed ? 'ALL PASSED' : 'SOME FAILED');
