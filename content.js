"use strict";

var inCards = [];
var outCards = [];
var totalRequests = 0;
var userId = 0;

/*
 * This section is for gathering existing trade data
*/


/*
 * Main function that scans for trades on the page, then
 * looks up and saves all cards involved in the trades
*/
async function findTradeCards() {
	// Indicate to the user that the extension is saving
	document.body.style.cursor = "wait";

	inCards = [];
	outCards = [];
	totalRequests = 0;
	// Selects all links associated with trades to extract the trade ids
	var tradesList = document.querySelectorAll("ul.user-status--list li.nm-notification.user-status.ng-scope:not(.ng-isolate-scope) a");
	if(tradesList.length == 0) {
		chrome.storage.local.set({"cards": {"inCards": [], "outCards": []}}, function() {
			document.body.style.cursor = "default";
			removeIcons();
			forAllElements(document, "div.nm-set-window", waitToAddIcons);
		});		
	}
	else {
		// Uses the trades api endpoint to get data on all cards involved in each trade
		// Note: requestSuccess() is executed when there was successful data returned
		for(var i = 0; i < tradesList.length; i++) {
			httpGetAsync("https://www.neonmob.com/api/trades/" + (tradesList[i].href.split("=")[1]), requestSuccess, tradesList.length);
		}
	}
}

/*
 * Makes an Http request to a url specified, then
 * executes a callback function when successful
*/
function httpGetAsync(theUrl, callback, expectedLength)
{
	var xmlHttp = new XMLHttpRequest();
	xmlHttp.onreadystatechange = function() { 
		if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
			callback(xmlHttp.responseText, expectedLength);
	}
	xmlHttp.open("GET", theUrl, true); // true for asynchronous 
	xmlHttp.send(null);
}

/*
 * Handles data returned from the request and constructs the objects to store it
 * Is also passed the expected number of requests to make
 * in order to save data properly
*/
function requestSuccess(response, expectedLength) {
	var bidder = JSON.parse(response).bidder.id;

	var bidderOffer = JSON.parse(response).bidder_offer.prints;
	var responderOffer = JSON.parse(response).responder_offer.prints;

	var outData;
	var inData;
	// Uses current user id recorded on page load to
	// determine who is the bidder and responder
	if(bidder == userId) {
		outData = bidderOffer;
		inData = responderOffer;
	}
	else {
		outData = responderOffer;
		inData = bidderOffer;
	}
	// Construct the inbound and outbound card list
	// Structure: [{"card-name": "name", "set-name": "name"}, ...]
	for(var i = 0; i < outData.length; i++) {
		var card = {"card-name": outData[i].name, "set-name": outData[i].sett_name};
		outCards.push(card);
	}
	
	for(var i = 0; i < inData.length; i++) {
		var card = {"card-name": inData[i].name, "set-name": inData[i].sett_name};
		inCards.push(card);
	}
	// Increments the number of requests processed
	totalRequests += 1;
	// Checks to see if all requests have been made
	// If so, then save all the data collected
	if(totalRequests === expectedLength) {
		chrome.storage.local.set({"cards": {"inCards": inCards, "outCards": outCards}}, function() {
			console.log("Data saved.");
			// Return the user's mouse to normal to signal a successful save
			document.body.style.cursor = "default";
			removeIcons();
			forAllElements(document, "div.nm-set-window", waitToAddIcons);
		});
	}
}







/*
 * This section is for displaying icons on the page
*/




/*
 * Uses the mutation library to call a function on all elements
 * that match a DOM selector under rootNode
*/
function forAllElements(rootNode, selector, callback) {
	rootNode.querySelectorAll(selector).forEach(callback);
	new MutationSummary({
		rootNode,
		queries: [{element: selector}],
		callback: (summaries) => summaries[0].added.forEach((elem) => callback(elem)),
	});
}

/*
 * Uses the mutation library to wait for a specific selector to
 * be added under rootNode
*/
function waitForElement(rootNode, selector) {
	const element = rootNode.querySelector(selector);
	if(element) return Promise.resolve(element);

	return new Promise((resolve) => {
		const observer = new MutationSummary({
			rootNode,
			queries: [{element: selector}],
			callback: (summaries) => {
				observer.disconnect();
				resolve(summaries[0].added[0]);
			},
		});
	});
}

/*
 * Waits for a card container to be added to the page,
 * then calls for icons to be added to the container
*/
async function waitToAddIcons(window) {
	var itemContainerSelector;
	var itemSelector;
	// TODO: Add cases here
	// Decide what to look for on the page given the global container (window) passed in
	if(window.className.includes("nm-set-window")) {
		itemContainerSelector = "div.columns.loaded";
		itemSelector = ".print";

		try {
			document.querySelector(".set-header .set-header--title a").title = document.querySelector("span.art-sett-large--pack span.loadTarget")['dataset']['setId'];
		}
		catch(e) {
			// console.log("Collection page not for set, skipping id...");
		}
	}
	else if(window.className.includes("nm-modal") && window.className.includes("trade")){
		itemContainerSelector = "div.trade--side--item-list";
		itemSelector = ".trade--item";
	}
	// Wait for that element to be added to the page
	await waitForElement(window, itemContainerSelector);
	// Load stored card data, then add icons to the page
	chrome.storage.local.get(['cards'], async function(result) {
		await addIcons(window, result, itemSelector);
	})
}

/*
 * Main handler for adding icons to the page
*/
async function addIcons(window, result, itemSelector) {
	// Parses saved data back into inbound and outbound card sets
	var savedInCards = result["cards"]["inCards"];
	var savedOutCards = result["cards"]["outCards"];
	// Attempt to add an icon to every "card" on the page
	forAllElements(window, itemSelector, (card) => {
		addIcon(card, savedInCards, savedOutCards, itemSelector);
	});
}

function addIcon(card, savedInCards, savedOutCards, cardSelector) {
	var cardName;
	// TODO: Add cases here
	// Decide what denotes a card's name based on the context (trade window, collection, etc.)
	switch(cardSelector) {
		case ".trade--item":
			cardName = card.querySelector(".trade--item--meta dd:first-of-type").textContent;
			break;
		case ".print":
			cardName = card.querySelector("span.print--meta span.print--name").textContent;
			break;
	}

	var setName;
	// TODO: Add cases here
	// Decide what denotes a card's series name based on the context (trade window, collection, etc.)
	switch(cardSelector) {
		case ".trade--item":
			// If the user has the trade enhancement userscript on, then the
			// set name will be embedded in a link inside the dd element
			try {
				setName = card.querySelector(".trade--item--meta dd:nth-of-type(2) a").textContent;
			}
			// If the user is vanilla, then it will just be in the dd element
			catch(e) {
				if(e instanceof ReferenceError || e instanceof TypeError) {
					setName = card.querySelector(".trade--item--meta dd:nth-of-type(2)").textContent;
				}
				else {
					console.error(e);
				}
			}
			break;
		case ".print":
			// setName = document.querySelector(".user-collection-views ul.selected h2.set-name").textContent;
			try {
				setName = document.querySelector(".set-header .set-header--title a").textContent.trim();
			}
			catch(e) {
				// console.log("No set title, skipping...");
				setName = null;
			}
			break;
	}
	// Check to see if the selected card matches any saved cards for both in- and out-bound
	if(setName != null) {
		var inMatches = [];
		for(var i = 0; i < savedInCards.length; i++) {
			if(cardName == savedInCards[i]["card-name"] && setName == savedInCards[i]["set-name"]) {
				inMatches.push(savedInCards[i]);
			}
		}
		var outMatches = [];
		for(var i = 0; i < savedOutCards.length; i++) {
			if(cardName == savedOutCards[i]["card-name"] && setName == savedOutCards[i]["set-name"]) {
				outMatches.push(savedOutCards[i]);
			}
		}
		// Actually add the icon's image onto the page (depending on its "direction" in/out)
		if(inMatches.length != 0) addImages(card, cardSelector, inMatches, "in");
		if(outMatches.length != 0) addImages(card, cardSelector, outMatches, "out");
	}
}

function addImages(card, cardSelector, matches, direction) {
	var container;
	// TODO: Add cases here
	// Decide where to add the icon based on the context (trade window, collection, etc.)
	switch(cardSelector) {
		case ".trade--item":
			if(card.querySelector("div.piece-image") == null)
				container = card.querySelector("div.piece-video");
			else container = card.querySelector("div.piece-image");
			break;
		case ".print":
			container = card.querySelector("span.print--overlay");
			break;
	}

	var img = document.createElement("img");
	// Build the url based on parameters (direction, 1/2+)
	var dirText = direction == "in" ? "down" : "up";
	if(matches.length > 1) img.src = chrome.extension.getURL("/images/" + dirText + "-circular-32-indicator.png");
	else img.src = chrome.extension.getURL("/images/" + dirText + "-circular-32.png");
	// Build the style based on where the icon should be
	var styleString = 'height: 20px !important; width: 20px !important; position: absolute; ';
	switch(cardSelector) {
		// Bottom right for trade window
		case ".trade--item":
			styleString += 'bottom: 3%; right: 3%; ';
			break;
		// Top left for collection window
		case ".print":
			styleString += 'left: 3%; top: 3%; ';
	}
	styleString += 'z-index: 4; cursor: default;';
	img.style = styleString;
	// Give the icon text to display when hovered
	img.title = "You have " + matches.length + " cop" + (matches.length > 1 ? "ies" : "y") + " in trades";
	// May or may not be needed (ex. removing all icons from page):
	img.classList.add("extension-icon");
	// TODO: Add cases here
	// Decide where to put the icon (before or after its container) based on context
	switch(cardSelector) {
		case ".trade--item":
			container.before(img);
			break;
		case ".print":
			container.after(img);
			break;
	}
}

/*
 * Wait for the trades list to come up, then gather trade data
*/
async function waitForTrades(window) {
	await waitForElement(window, "ul.user-status--list");
	findTradeCards();
}

function removeIcons() {
	var elements = document.getElementsByClassName("extension-icon");
	while(elements.length > 0){
		elements[0].parentNode.removeChild(elements[0]);
	}
}

window.onload = function() {
	// Gets the logged in user's id (important for checking who is who in a trade)
	userId = JSON.parse(document.querySelector("input#user-json").value).id;
	console.log("Page loaded!");
	// Gather data whenever the trades list is shown
	forAllElements(document, "ul.user-status--list", findTradeCards);
	// Display icons when the trade window is shown
	forAllElements(document, "div.nm-modal.trade", waitToAddIcons);
	// Display icons when the collection window is shown
	forAllElements(document, "div.nm-set-window", waitToAddIcons);
}


// document.querySelector("span.art-sett-large--pack span.loadTarget")['dataset']['setId'] = set id from collection page

