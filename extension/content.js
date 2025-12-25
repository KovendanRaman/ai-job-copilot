// content.js
console.log("AI Job Copilot: Content script active.");

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "scrape_page") {
    
    let jobText = "";
    let source = "";
    
    // Strategy: Find the actual job description by looking for content patterns
    // LinkedIn job descriptions typically contain phrases like:
    // "To design and implement", "Responsibilities", "Requirements", etc.
    
    // Step 1: Try to find LinkedIn's job description container with more specific selectors
    const linkedinSelectors = [
      'div[class*="jobs-description"]',
      'div[class*="job-details"]',
      'section[class*="jobs-description"]',
      'div[data-test-id*="job"]',
      '.jobs-details__main-content',
      '[id*="job-details"]',
      '[id*="jobDescription"]'
    ];
    
    for (const selector of linkedinSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = (element.innerText || element.textContent || "").trim();
        // Look for actual job description content (not just headers)
        const lowerText = text.toLowerCase();
        const hasJobContent = lowerText.includes("to design") || 
                             lowerText.includes("responsibilities") ||
                             lowerText.includes("requirements") ||
                             lowerText.includes("qualifications") ||
                             lowerText.includes("experience") ||
                             (lowerText.includes("source code") && text.length > 500);
        
        if (hasJobContent && text.length > 500) {
          jobText = text;
          source = `LinkedIn selector: ${selector}`;
          console.log(`✓ Found LinkedIn job description using: ${selector}`);
          break;
        }
      }
      if (jobText) break;
    }
    
    // Step 2: If selectors didn't work, search all divs/sections for job description content
    if (!jobText || jobText.length < 500) {
      const allElements = document.querySelectorAll('div, section, article, span');
      const candidates = [];
      
      for (const element of allElements) {
        const text = (element.innerText || element.textContent || "").trim();
        if (text.length < 500 || text.length > 50000) continue; // Skip too short or too long
        
        const lowerText = text.toLowerCase();
        // Score based on job description indicators
        let score = 0;
        if (lowerText.includes("to design")) score += 10;
        if (lowerText.includes("responsibilities")) score += 8;
        if (lowerText.includes("requirements")) score += 8;
        if (lowerText.includes("qualifications")) score += 8;
        if (lowerText.includes("source code")) score += 5;
        if (lowerText.includes("experience")) score += 5;
        if (lowerText.includes("develop")) score += 3;
        if (lowerText.includes("implement")) score += 3;
        
        // Penalize navigation/header content
        if (lowerText.includes("apply now") || lowerText.includes("save job")) score -= 5;
        if (lowerText.includes("people you can")) score -= 5;
        if (lowerText.startsWith("about the job job description")) score -= 3;
        
        if (score > 5) {
          candidates.push({ text, score, element });
        }
      }
      
      if (candidates.length > 0) {
        // Sort by score and take the best candidate
        candidates.sort((a, b) => b.score - a.score);
        jobText = candidates[0].text;
        source = `Content-based search (score: ${candidates[0].score})`;
        console.log(`✓ Found job description using content-based search`);
      }
    }
    
    // Step 3: Try to extract from main content area and find the largest meaningful block
    if (!jobText || jobText.length < 500) {
      const mainContent = document.querySelector('main') || 
                         document.querySelector('[role="main"]') ||
                         document.querySelector('div[class*="jobs-details"]');
      
      if (mainContent) {
        // Get all text blocks and find the one that looks most like a job description
        const textBlocks = [];
        const walker = document.createTreeWalker(
          mainContent,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        let currentBlock = "";
        let currentParent = null;
        
        while (node = walker.nextNode()) {
          const parent = node.parentElement;
          const text = node.textContent.trim();
          
          if (text.length > 50) {
            if (parent !== currentParent) {
              if (currentBlock.length > 500) {
                textBlocks.push(currentBlock);
              }
              currentBlock = text;
              currentParent = parent;
            } else {
              currentBlock += " " + text;
            }
          }
        }
        
        if (currentBlock.length > 500) {
          textBlocks.push(currentBlock);
        }
        
        // Find the block with most job-related keywords
        let bestBlock = "";
        let bestScore = 0;
        for (const block of textBlocks) {
          const lower = block.toLowerCase();
          let score = 0;
          if (lower.includes("to design") || lower.includes("responsibilities") || 
              lower.includes("requirements") || lower.includes("qualifications")) {
            score = block.length; // Prefer longer blocks with keywords
          }
          if (score > bestScore) {
            bestScore = score;
            bestBlock = block;
          }
        }
        
        if (bestBlock) {
          jobText = bestBlock.trim();
          source = "TreeWalker extraction from main content";
          console.log(`✓ Found job description using TreeWalker`);
        }
      }
    }
    
    // Step 4: Indeed fallback
    if (!jobText || jobText.length < 500) {
      const indeedContainer = document.querySelector('#jobDescriptionText');
      if (indeedContainer) {
        jobText = indeedContainer.innerText || indeedContainer.textContent;
        source = "Indeed job description container";
        console.log("✓ Found Indeed job description container");
      }
    }
    
    // Step 5: Last resort - try to extract from body but filter intelligently
    if (!jobText || jobText.length < 500) {
      const bodyText = document.body.innerText;
      // Try to find the section between "Job Description" and common end markers
      const startMarkers = ["job description", "about the job", "to design", "responsibilities"];
      const endMarkers = ["show more", "people you can", "apply now", "save job", "similar jobs"];
      
      let startIdx = -1;
      for (const marker of startMarkers) {
        const idx = bodyText.toLowerCase().indexOf(marker);
        if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
          startIdx = idx;
        }
      }
      
      if (startIdx !== -1) {
        let endIdx = bodyText.length;
        for (const marker of endMarkers) {
          const idx = bodyText.toLowerCase().indexOf(marker, startIdx + 100);
          if (idx !== -1 && idx < endIdx) {
            endIdx = idx;
          }
        }
        
        const extracted = bodyText.substring(startIdx, endIdx).trim();
        if (extracted.length > 500) {
          jobText = extracted;
          source = "Body text extraction with markers";
          console.log("✓ Extracted from body text using markers");
        }
      }
    }
    
    // Final fallback
    if (!jobText || jobText.length < 200) {
      jobText = document.body.innerText;
      source = "document.body.innerText (last resort)";
      console.log("⚠ Using fallback: document.body.innerText");
    }
    
    console.log(`Scraped text length: ${jobText.length} characters`);
    console.log(`Source: ${source}`);
    console.log(`First 300 chars: ${jobText.substring(0, 300)}`);
    
    // Send the text back to the popup
    sendResponse({ success: true, text: jobText });
  }
  return true; // Keep the message channel open for async response
});