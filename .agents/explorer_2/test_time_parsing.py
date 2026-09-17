import json
from datetime import datetime, timedelta

def test_time_parsing():
    test_cases = [
        ("04:00 pm", 16),
        ("4:00 PM", 16),
        ("04:00 PM", 16),
        ("05:00 pm", 17),
        ("5:00 PM", 17),
        ("08:00 am", 8),
        ("8:00 AM", 8),
        ("12:00 pm", 12),
        ("12:00 am", 0),
        ("16:00", 16),
        ("08:00", 8),
        ("03:30 pm", 15), # 3:30 pm -> 15:30 -> falls in 15h
    ]
    
    print("--- TESTING TIME PARSING ---")
    for time_str, expected in test_cases:
        # Old logic:
        parts = time_str.split(':')
        old_parsed = int(parts[0]) if parts[0].isdigit() else None
        
        # New logic:
        s = time_str.strip().lower()
        is_pm = 'pm' in s
        is_am = 'am' in s
        clean = s.replace('am', '').replace('pm', '').strip()
        p = clean.split(':')
        h = int(p[0])
        if is_pm and h < 12:
            h += 12
        if is_am and h == 12:
            h = 0
            
        print(f"Input: '{time_str}' | Old parsed: {old_parsed} (Match expected {expected}: {old_parsed == expected}) | New parsed: {h} (Match expected {expected}: {h == expected})")

if __name__ == "__main__":
    test_time_parsing()
