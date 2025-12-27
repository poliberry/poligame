import { Game } from "@/types";

/**
 * Smart search that matches games by multiple criteria:
 * - Title (fuzzy matching)
 * - Tags
 * - Developer
 * - Publisher
 * - Launcher
 */
export function smartSearch(games: Game[], query: string): Game[] {
  if (!query.trim()) {
    return games;
  }

  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  
  return games.filter((game) => {
    // Calculate relevance score
    let score = 0;
    
    // Title matching (highest weight)
    const titleLower = game.title.toLowerCase();
    if (titleLower === query.toLowerCase()) {
      score += 100; // Exact match
    } else if (titleLower.startsWith(query.toLowerCase())) {
      score += 50; // Starts with query
    } else if (titleLower.includes(query.toLowerCase())) {
      score += 25; // Contains query
    }
    
    // Check if all search terms are found in title (fuzzy)
    const allTermsInTitle = searchTerms.every(term => titleLower.includes(term));
    if (allTermsInTitle) {
      score += 30;
    }
    
    // Tags matching
    if (game.tags && game.tags.length > 0) {
      const tagsLower = game.tags.map(t => t.toLowerCase());
      searchTerms.forEach(term => {
        if (tagsLower.some(tag => tag.includes(term) || term.includes(tag))) {
          score += 15;
        }
      });
    }
    
    // Developer matching
    if (game.developer) {
      const developerLower = game.developer.toLowerCase();
      searchTerms.forEach(term => {
        if (developerLower.includes(term)) {
          score += 10;
        }
      });
    }
    
    // Publisher matching
    if (game.publisher) {
      const publisherLower = game.publisher.toLowerCase();
      searchTerms.forEach(term => {
        if (publisherLower.includes(term)) {
          score += 10;
        }
      });
    }
    
    // Launcher matching
    const launcherLower = game.launcher.toLowerCase();
    searchTerms.forEach(term => {
      if (launcherLower.includes(term)) {
        score += 5;
      }
    });
    
    // Description matching (lower weight)
    if (game.description) {
      const descLower = game.description.toLowerCase();
      searchTerms.forEach(term => {
        if (descLower.includes(term)) {
          score += 3;
        }
      });
    }
    
    return score > 0;
  }).sort((a, b) => {
    // Recalculate scores for sorting
    const scoreA = calculateScore(a, query);
    const scoreB = calculateScore(b, query);
    return scoreB - scoreA; // Higher score first
  });
}

function calculateScore(game: Game, query: string): number {
  const searchTerms = query.toLowerCase().trim().split(/\s+/);
  let score = 0;
  const titleLower = game.title.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (titleLower === queryLower) {
    score += 100;
  } else if (titleLower.startsWith(queryLower)) {
    score += 50;
  } else if (titleLower.includes(queryLower)) {
    score += 25;
  }
  
  const allTermsInTitle = searchTerms.every(term => titleLower.includes(term));
  if (allTermsInTitle) {
    score += 30;
  }
  
  if (game.tags && game.tags.length > 0) {
    const tagsLower = game.tags.map(t => t.toLowerCase());
    searchTerms.forEach(term => {
      if (tagsLower.some(tag => tag.includes(term) || term.includes(tag))) {
        score += 15;
      }
    });
  }
  
  if (game.developer) {
    const developerLower = game.developer.toLowerCase();
    searchTerms.forEach(term => {
      if (developerLower.includes(term)) {
        score += 10;
      }
    });
  }
  
  if (game.publisher) {
    const publisherLower = game.publisher.toLowerCase();
    searchTerms.forEach(term => {
      if (publisherLower.includes(term)) {
        score += 10;
      }
    });
  }
  
  return score;
}

