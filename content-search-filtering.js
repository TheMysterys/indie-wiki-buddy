const currentURL = new URL(document.location);
let filteredWikis = [];
let hiddenWikisRevealed = {};

// Create object prototypes for getting and setting attributes:
Object.prototype.get = function (prop) {
  this[prop] = this[prop] || {};
  return this[prop];
};
Object.prototype.set = function (prop, value) {
  this[prop] = value;
}

// Function to create an observer to watch for mutations on search pages
function addLocationObserver(callback) {
  const config = {
    attributes: false,
    childList: true,
    subtree: true
  }
  const observer = new MutationObserver(callback);
  observer.observe(document.body, config);
}

// Load website data:
async function getData() {
  const LANGS = ["DE", "EN", "ES", "FR", "IT", "PL", "TOK"];
  let sites = [];
  let promises = [];
  for (let i = 0; i < LANGS.length; i++) {
    promises.push(fetch(chrome.runtime.getURL('data/sites' + LANGS[i] + '.json'))
      .then((resp) => resp.json())
      .then(function (jsonData) {
        jsonData.forEach((site) => {
          site.origins.forEach((origin) => {
            sites.push({
              "id": site.id,
              "origin": origin.origin,
              "origin_group": site.origins_label,
              "origin_base_url": origin.origin_base_url,
              "origin_content_path": origin.origin_content_path,
              "destination": site.destination,
              "destination_base_url": site.destination_base_url,
              "destination_content_path": site.destination_content_path,
              "destination_content_prefix": (site.destination_content_prefix ? site.destination_content_prefix : ""),
              "destination_platform": site.destination_platform,
              "destination_icon": site.destination_icon,
              "lang": LANGS[i]
            })
          })
        });
      }));
  }
  await Promise.all(promises);

  return sites;
}

function insertCSS() {
  // Output CSS
  styleString = `
    .iwb-notice {
      display: block !important;
      margin: .5em .5em 1em .5em !important;
      padding: .5em .5em .5em 1em !important;
      border-left: 3px solid #FFCC33 !important;
      font-size: 14px !important;
      color: white !important;
      mix-blend-mode: difference !important;
    }
    .iwb-notice a {
      text-decoration: underline !important;
      color: white !important;
      mix-blend-mode: difference !important;
    }
    .iwb-notice button {
      cursor: pointer !important;
      display: inline-block !important;
      padding: 2px 8px !important;
      margin: 8px 8px 0 0 !important;
      background-color: transparent !important;
      border: 1px solid !important;
      border-radius: 5px !important; 
      font-size: 12px !important;
      color: white !important;
      mix-blend-mode: difference !important;
      text-align: left !important;
    }
    .iwb-hide {
      display: none !important;
    }
    .iwb-show {
      display: block !important;
    }
    .iwb-notice button:hover {
      outline: 1px solid !important;
    }
    .iwb-new-link {
      display: inline-block;
      font-size: 12px !important;
      text-decoration: none;
      padding-left: 5px;
      position: relative;
    }
    .iwb-new-link:hover {
      text-decoration: none;
      z-index: 9999999;
    }
    .iwb-new-link button {
      cursor: pointer;
      color: white;
      background: #005799;
      border: 0px solid #fff;
      border-radius: 10px;
      padding: 5px 10px;
      margin: .5em 0 .2em 0;
      font-size: 1.2em;
      width: fit-content;
    }
    .iwb-new-link button:hover {
      background: #00467a;
    }
    .iwb-new-link button * {
      vertical-align: middle;
    }
    .iwb-new-link div:first-of-type {
      display: inline-block;
      background: white; 
      border-radius: 16px;
      margin-right: 10px;
      width: fit-content;
      height: fit-content;
      line-height: 12px;
      padding: 5px;
    }
    .iwb-new-link img {
      width: 12px;
    }
    .iwb-disavow > *:not(.iwb-new-link) {
      opacity: 60%;
      pointer-events: none;
      cursor: default;
    }
    .iwb-disavow > a:not(.iwb-new-link), .iwb-disavow > *:not(.iwb-new-link) a, .iwb-disavow > *:not(.iwb-new-link) a * {
      text-decoration: line-through !important;
    }
  `
  style = document.createElement('style');
  style.textContent = styleString;
  document.head.append(style);
}

// Function to convert strings to consistent IDs
// Used to convert wiki names to element IDs
function stringToId(string) {
  return string.replaceAll(' ', '-').replaceAll("'", '').replace(/\W/g, '').toLowerCase();
}

// Function to escape string to use in regex
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function redirectSearchResults(searchResultContainer, site, link) {
  let countFiltered = 0;
  // Build new URL:
  let article = link.split(site['origin_base_url'] + site['origin_content_path'])[1]?.split('#')[0].split('?')[0].split('&')[0];
  let newURL = '';
  if (article) {
    let searchParams = '';
    switch (site['destination_platform']) {
      case 'mediawiki':
        searchParams = 'Special:Search/' + site['destination_content_prefix'] + article;
        break;
      case 'doku':
        searchParams = 'start?do=search&q=' + article;
        break;
    }
    newURL = 'https://' + site["destination_base_url"] + site["destination_content_path"] + searchParams;
  } else {
    newURL = 'https://' + site["destination_base_url"];
  }

  if (searchResultContainer && !searchResultContainer.classList.contains('iwb-detected')) {
    searchResultContainer.classList.add('iwb-detected');
    var indieResultLink = document.createElement('a');
    indieResultLink.href = newURL;
    indieResultLink.classList.add('iwb-new-link');
    var indieResultButton = document.createElement('button');
    var indieResultFaviconContainer = document.createElement('div');
    var indieResultFavicon = document.createElement('img');
    indieResultFavicon.alt = '';
    indieResultFavicon.width = '12';
    indieResultFavicon.height = '12';
    indieResultFavicon.src = chrome.runtime.getURL('favicons/' + site.lang.toLowerCase() + '/' + site.destination_icon);
    indieResultFaviconContainer.append(indieResultFavicon);
    var indieResultText = document.createElement('span');
    if (article) {
      indieResultText.innerText = 'Look up "' + decodeURIComponent(decodeURIComponent(article.replaceAll('_', ' '))) + '" on ' + site.destination;
    } else {
      indieResultText.innerText = 'Visit ' + site.destination + ' instead';
    }
    indieResultButton.append(indieResultFaviconContainer);
    indieResultButton.append(indieResultText);
    indieResultLink.appendChild(indieResultButton);

    searchResultContainer.prepend(indieResultLink);
    searchResultContainer.classList.add('iwb-disavow');
    countFiltered++;
  }
  return countFiltered;
}

function hideSearchResults(searchResultContainer, searchEngine, site) {
  let countFiltered = 0;
  // Insert search result removal notice
  if (!filteredWikis.includes(site.lang + ' ' + site.origin_group)) {
    filteredWikis.push(site.lang + ' ' + site.origin_group);

    let elementId = stringToId(site.lang + '-' + site.origin_group);
    hiddenWikisRevealed[elementId] = false;

    let searchRemovalNotice = document.createElement('aside');
    searchRemovalNotice.id = 'iwb-notice-' + elementId;
    searchRemovalNotice.classList.add('iwb-notice');
    let searchRemovalNoticeLink = document.createElement('a');
    searchRemovalNoticeLink.href = 'https://' + site.destination_base_url;
    searchRemovalNoticeLink.textContent = site.destination;
    searchRemovalNoticePretext = document.createTextNode('Indie Wiki Buddy has filtered out results from ' + site.origin_group + (site.lang !== 'EN' ? ' (' + site.lang + ')' : '') + '. Look for results from ');
    searchRemovalNoticePosttext = document.createTextNode(' instead!');
    linebreak = document.createElement("br");
    searchRemovalNotice.appendChild(searchRemovalNoticePretext);
    searchRemovalNotice.appendChild(searchRemovalNoticeLink);
    searchRemovalNotice.appendChild(searchRemovalNoticePosttext);
    searchRemovalNotice.appendChild(linebreak);

    // Output "show results" button
    let showResultsButton = document.createElement('button');
    showResultsButton.classList.add('iwb-show-results-button');
    showResultsButton.setAttribute('data-group', 'iwb-search-result-' + elementId);
    showResultsButton.textContent = 'Show filtered results';
    searchRemovalNotice.appendChild(showResultsButton);
    showResultsButton.onclick = function (e) {
      if (e.target.textContent.includes('Show')) {
        e.target.textContent = 'Re-hide filtered results';
        hiddenWikisRevealed[elementId] = true;
        const selector = e.currentTarget.dataset.group;
        document.querySelectorAll('.' + selector).forEach(el => {
          el.classList.add('iwb-show');
        })
      } else {
        e.target.textContent = 'Show filtered results';
        hiddenWikisRevealed[elementId] = false;
        const selector = e.currentTarget.dataset.group;
        document.querySelectorAll('.' + selector).forEach(el => {
          el.classList.remove('iwb-show');
        })
      }
    }

    // Output "disable filtering" button
    let disableFilterButton = document.createElement('button');
    disableFilterButton.classList.add('iwb-disable-filtering-button');
    disableFilterButton.textContent = 'Stop filtering ' + site.origin_group + ' in future searches';
    disableFilterButton.style.border = '1px solid';
    searchRemovalNotice.appendChild(disableFilterButton);
    disableFilterButton.onclick = function (e) {
      if (e.target.textContent.includes('Stop')) {
        chrome.storage.sync.get({ 'siteSettings': {} }, function (response) {
          response.siteSettings.get(site.id).set('searchFilter', 'false');
          chrome.storage.sync.set({ 'siteSettings': response.siteSettings });
          e.target.textContent = 'Re-enable filtering for ' + site.origin_group;
        })
      } else {
        chrome.storage.sync.get({ 'siteSettings': {} }, function (response) {
          response.siteSettings.get(site.id).set('searchFilter', 'true');
          chrome.storage.sync.set({ 'siteSettings': response.siteSettings });
          e.target.textContent = 'Stop filtering ' + site.origin_group + ' in future searches';
        })
      }
    }

    switch (searchEngine) {
      case 'google':
        if (document.querySelector('#search')) {
          document.querySelector('#search').prepend(searchRemovalNotice);
        } else if (document.querySelector('#topstuff')) {
          document.querySelector('#topstuff').prepend(searchRemovalNotice);
        } else if (document.querySelector('#main')) {
          var el = document.querySelector('#main');
          if (el.querySelector('#main > div[data-hveid]')) {
            el.insertBefore(searchRemovalNotice, el.querySelector('div[data-hveid]'));
          } else {
            el.insertBefore(searchRemovalNotice, el.querySelector('div div[data-hveid]').parentElement);
          }
        };
        break;
      case 'bing':
        var li = document.createElement('li');
        li.appendChild(searchRemovalNotice);
        document.querySelector('#b_results').prepend(li);
        break;
      case 'duckduckgo':
        if (document.getElementById('web_content_wrapper')) {
          var li = document.createElement('li');
          li.appendChild(searchRemovalNotice);
          document.querySelector('#web_content_wrapper ol').prepend(li);
        } else {
          document.getElementById('links').prepend(searchRemovalNotice);
        }
        break;
      case 'brave':
        document.querySelector('body').prepend(searchRemovalNotice);
        break;
      case 'ecosia':
        document.querySelector('body').prepend(searchRemovalNotice);
        break;
      case 'startpage':
        document.querySelector('#main').prepend(searchRemovalNotice);
        break;
      case 'yahoo':
        if (document.querySelector('#web > ol')) {
          var li = document.createElement('li');
          li.appendChild(searchRemovalNotice);
          document.querySelector('#web > ol').prepend(li);
        } else {
          document.querySelector('#main-algo').prepend(searchRemovalNotice);
        }
        break;
      default:
    }
  }

  if (!Array.from(searchResultContainer.classList).includes('iwb-hide')) {
    let elementId = stringToId(site.lang + '-' + site.origin_group);
    searchResultContainer.classList.add('iwb-search-result-' + elementId);
    searchResultContainer.classList.add('iwb-hide');
    countFiltered++;
    if (hiddenWikisRevealed[elementId]) {
      searchResultContainer.classList.add('iwb-show');
    }
  }

  return countFiltered;
}

function filterSearchResults(searchResults, searchEngine, storage) {
  getData().then(sites => {
    let countFiltered = 0;

    for (let searchResult of searchResults) {
      try {
        let searchResultLink = '';
        if (searchEngine === 'bing') {
          searchResultLink = searchResult.innerHTML.replaceAll('<strong>', '').replaceAll('</strong>', '');
        } else {
          searchResultLink = searchResult.closest('a[href]').href;
        }
        let link = String(decodeURIComponent(searchResultLink));

        if (searchEngine === 'google') {
          // Break if image result:
          if (link.includes('imgurl=')) {
            break;
          }
        }

        // Check if site is in our list of wikis:
        let matchingSites = sites.filter(el => {
          if (link.substring(8).includes('/')) {
            // If the URL has a path, check if an exact match with base URL or base URL + content path
            // This is done to ensure we capture non-English Fandom wikis correctly
            return (link === 'https://' + el.origin_base_url) || (link.includes('https://' + el.origin_base_url + el.origin_content_path));
          } else {
            // If URL does not have a path, just check base URL
            return link.includes('https://' + el.origin_base_url);
          }
        });
        if (matchingSites.length > 0) {
          // Select match with longest base URL 
          let closestMatch = "";
          matchingSites.forEach(site => {
            if (site.origin_base_url.length > closestMatch.length) {
              closestMatch = site.origin_base_url;
            }
          });
          let site = matchingSites.find(site => site.origin_base_url === closestMatch);
          if (site) {
            // Get user's settings for the wiki
            let settings = storage.siteSettings || {};
            let id = site['id'];
            let searchFilterSetting = '';
            if (settings.hasOwnProperty(id) && settings[id].searchFilter) {
              searchFilterSetting = settings[id].searchFilter;
            } else if (storage.defaultSearchFilterSettings && storage.defaultSearchFilterSettings[site.language]) {
              searchFilterSetting = storage.defaultSearchFilterSettings[site.language];
            } else {
              searchFilterSetting = 'true';
            }
            if (searchFilterSetting === 'true') {
              // Output stylesheet if not already done
              if (filteredWikis.length === 0) {
                // Wait for head to be available
                const headElement = document.querySelector('head');
                if (headElement) {
                  insertCSS();
                } else {
                  const docObserver = new MutationObserver(function (mutations, mutationInstance) {
                    const headElement = document.querySelector('head');
                    if (headElement) {
                      insertCSS();
                      mutationInstance.disconnect();
                    }
                  });
                  docObserver.observe(document, {
                    childList: true,
                    subtree: true
                  });
                }
              }

              let cssQuery = '';
              let searchResultContainer = null;
              switch (searchEngine) {
                case 'google':
                  searchResultContainer = searchResult.closest('div[data-hveid]');
                  break;
                case 'bing':
                  searchResultContainer = searchResult.closest('li.b_algo');
                  break;
                case 'duckduckgo':
                  searchResultContainer = searchResult.closest('li[data-layout], div.web-result');
                  break;
                case 'brave':
                  searchResultContainer = searchResult.closest('div.snippet');
                  break;
                case 'ecosia':
                  searchResultContainer = searchResult.closest('div.mainline__result-wrapper article div.result__body');
                  break;
                case 'startpage':
                  searchResultContainer = searchResult.closest('div.w-gl__result');
                  break;
                case 'yahoo':
                  searchResultContainer = searchResult.closest('#web > ol > li div.itm .exp, #web > ol > li div.algo, #web > ol > li, section.algo');
                  break;
                default:
              }

              if (searchResultContainer) {
                if (storage.searchSetting === 'hide') {
                  countFiltered += hideSearchResults(searchResultContainer, searchEngine, site);
                } else {
                  countFiltered += redirectSearchResults(searchResultContainer, site, link);
                }
              }
            }
          }
        }
      } catch (e) {
        console.log('Indie Wiki Buddy failed to properly parse search results with error: ' + e);
      }
    };
    addLocationObserver(main);
    if (countFiltered > 0) {
      chrome.storage.sync.set({ 'countSearchFilters': (storage.countSearchFilters ?? 0) + countFiltered });
    }
  });
}

function main(mutations = null, observer = null) {
  if (observer) {
    observer.disconnect();
  }
  chrome.storage.local.get(function (localStorage) {
    chrome.storage.sync.get(function (syncStorage) {
      const storage = { ...syncStorage, ...localStorage };
      // Check if extension is on:
      if ((storage.power ?? 'on') === 'on') {
        // Determine which search engine we're on
        if ((storage.searchSetting ?? 'replace') !== 'nothing') {
          if (currentURL.hostname.includes('www.google.')) {
            // Function to filter search results in Google
            function filterGoogle() {
              let searchResults = document.querySelectorAll("div[data-hveid] a[href*='fandom.com']:first-of-type:not([role='button']):not([target]), div[data-hveid] a[href*='fextralife.com']:first-of-type:not([role='button']):not([target])");
              filterSearchResults(searchResults, 'google', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterGoogle();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterGoogle();
                }
              }, { once: true });
            }
          } else if (currentURL.hostname.includes('duckduckgo.com') && (currentURL.search.includes('q=') || currentURL.pathname.includes('html'))) {
            // Function to filter search results in DuckDuckGo
            function filterDuckDuckGo() {
              let searchResults = document.querySelectorAll('h2>a[href*="fandom.com"], h2>a[href*="fextralife.com"]');
              filterSearchResults(searchResults, 'duckduckgo', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterDuckDuckGo();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterDuckDuckGo();
                }
              }, { once: true });
            }
          } else if (currentURL.hostname.includes('www.bing.com')) {
            // Function to filter search results in Bing
            function filterBing() {
              let searchResults = Array.from(document.querySelectorAll('.b_attribution>cite')).filter(el => el.innerHTML.includes('fandom.com') || el.innerHTML.includes('fextralife.com'));
              filterSearchResults(searchResults, 'bing', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterBing();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterBing();
                }
              }, { once: true });
            }
          } else if (currentURL.hostname.includes('search.brave.com')) {
            // Function to filter search results in Brave
            function filterBrave() {
              let searchResults = Array.from(document.querySelectorAll('div.snippet[data-type="web"] a')).filter(el => el.innerHTML.includes('fandom.com') || el.innerHTML.includes('fextralife.com'));
              filterSearchResults(searchResults, 'brave', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterBrave();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterBrave();
                }
              }, { once: true });
            }
          } else if (currentURL.hostname.includes('ecosia.org')) {
            // Function to filter search results in Ecosia
            function filterEcosia() {
              let searchResults = Array.from(document.querySelectorAll('section.mainline .result__title a.result__link')).filter(el => el.href.includes('fandom.com') || el.href.includes('fextralife.com'));
              filterSearchResults(searchResults, 'ecosia', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterEcosia();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterEcosia();
                }
              }, { once: true });
            }
          } else if (currentURL.hostname.includes('startpage.com')) {
            // Function to filter search results in Startpage
            function filterStartpage() {
              let searchResults = Array.from(document.querySelectorAll('a.result-link')).filter(el => el.href.includes('fandom.com') || el.href.includes('fextralife.com'));
              filterSearchResults(searchResults, 'startpage', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterStartpage();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterStartpage();
                }
              }, { once: true });
            }
          } else if (currentURL.hostname.includes('yahoo.com')) {
            // Function to filter search results in Yahoo
            function filterYahoo() {
              let searchResults = Array.from(document.querySelectorAll('#web > ol > li a:not(.thmb), #main-algo section.algo a:not(.thmb)')).filter(el => el.href.includes('fandom.com') || el.href.includes('fextralife.com'));
              filterSearchResults(searchResults, 'yahoo', storage);
            }

            // Wait for document to be interactive/complete:
            if (['interactive', 'complete'].includes(document.readyState)) {
              filterYahoo();
            } else {
              document.addEventListener('readystatechange', e => {
                if (['interactive', 'complete'].includes(document.readyState)) {
                  filterYahoo();
                }
              }, { once: true });
            }
          }
        }
      }
    });
  });
}

main();