"use strict";

chrome.runtime.onMessage.addListener(function(msg, sender) {
	if(msg.findTrades) {
		findTradeIds();
	}
});

var tradeIds = [];
var inCards = [];
var outCards = [];

async function findTradeIds() {
	tradeIds = [];
	inCards = [];
	outCards = [];

	var x = document.querySelectorAll("ul.user-status--list li.nm-notification.user-status.ng-scope:not(.ng-isolate-scope) a");
	if(x.length == 0) {
		sendMsg("No trades found.", "error");
	}
	else {
		var y = [];
		for(var i = 0; i < x.length; i++) {
			y.push(x[i].href.split("=")[1]);
		}
		for(var i = 0; i < y.length; i++) {
			tradeIds.push(y[i]);
		}

		for(var i = 0; i < tradeIds.length; i++) {
			httpGetAsync("https://www.neonmob.com/api/trades/" + tradeIds[i], requestSuccess);
		}
		chrome.storage.local.set({"cards": {"inCards": inCards, "outCards": outCards}}, function() {
			sendMsg("Trades found.", "normal");
			// console.log("Saved data");
		});
	}
}

function sendMsg(msg, type) {
	chrome.runtime.sendMessage({data: msg, type: type}, function(response) {
	});
}

function requestSuccess(response) {
	var outData = JSON.parse(response).bidder_offer.prints;
	// console.log(outData[0]["piece_assets"]["image"]["xlarge-gray"]);
	for(var i = 0; i < outData.length; i++) {
		var card = {"card-name": outData[i].name, "set-name": outData[i].sett_name, "images": []};
		if(outData[i]["piece_assets"]["video"] != null) {
			card.images.push("https:" + outData[i]["piece_assets"]["video"]["medium"]["sources"][0]["url"]);
			card.images.push("https:" + outData[i]["piece_assets"]["video"]["medium"]["sources"][1]["url"]);
		}
		else {
			card.images.push("https:" + outData[i]["piece_assets"]["image"]["xlarge"]["url"]);
			card.images.push("https:" + outData[i]["piece_assets"]["image"]["xlarge-gray"]["url"]);
			card.images.push("https:" + outData[i]["piece_assets"]["image"]["medium"]["url"]);
			card.images.push("https:" + outData[i]["piece_assets"]["image"]["medium-gray"]["url"]);
		}
		outCards.push(card);
	}
	var inData = JSON.parse(response).responder_offer.prints;
	for(var i = 0; i < inData.length; i++) {
		var card = {"card-name": inData[i].name, "set-name": inData[i].sett_name, "images": []};
		if(inData[i]["piece_assets"]["video"] != null) {
			card.images.push("https:" + inData[i]["piece_assets"]["video"]["medium"]["sources"][0]["url"]);
			card.images.push("https:" + inData[i]["piece_assets"]["video"]["medium"]["sources"][1]["url"]);
		}
		else {
			card.images.push("https:" + inData[i]["piece_assets"]["image"]["xlarge"]["url"]);
			card.images.push("https:" + inData[i]["piece_assets"]["image"]["xlarge-gray"]["url"]);
			card.images.push("https:" + inData[i]["piece_assets"]["image"]["medium"]["url"]);
			card.images.push("https:" + inData[i]["piece_assets"]["image"]["medium-gray"]["url"]);
		}
		inCards.push(card);
	}
}

function httpGetAsync(theUrl, callback)
{
    var xmlHttp = new XMLHttpRequest();
    xmlHttp.onreadystatechange = function() { 
        if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
            callback(xmlHttp.responseText);
    }
    xmlHttp.open("GET", theUrl, false); // true for asynchronous 
    xmlHttp.send(null);
}

function forAllElements(rootNode, selector, callback) {
	rootNode.querySelectorAll(selector).forEach(callback);
	new MutationSummary({
		rootNode,
		queries: [{element: selector}],
		callback: (summaries) => summaries[0].added.forEach((elem) => callback(elem)),
	});
}

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

async function waitToAddIndicatorsTradePage(tradeWindow) {
	await waitForElement(tradeWindow, "div.trade--side--item-list");
	chrome.storage.local.get(['cards'], async function(result) {
		await addIndicatorsTradePage(tradeWindow, result);
	});
	
}

async function addIndicatorsTradePage(tradeWindow, result) {
	var savedInCards = result["cards"]["inCards"];
	var savedOutCards = result["cards"]["outCards"];
	forAllElements(tradeWindow, ".trade--item", (card) => {
		addTradeIndicator(card, savedInCards, savedOutCards);
	});
}

async function waitToAddIndicatorsCollectionPage(collectionWindow) {
	await waitForElement(collectionWindow, "div.columns.loaded");
	chrome.storage.local.get(['cards'], async function(result) {
		await addIndicatorsCollectionPage(collectionWindow, result);
	});
}

async function addIndicatorsCollectionPage(collectionWindow, result) {
	var savedInCards = result["cards"]["inCards"];
	var savedOutCards = result["cards"]["outCards"];
	var page = document.querySelector(".user-collection-views");
	var setName = page.querySelector("ul.selected h2.set-name").textContent;
	forAllElements(collectionWindow, ".print", (card) => {
		addCollectionIndicator(card, savedInCards, savedOutCards, setName);
	});
}

function addCollectionIndicator(card, savedInCards, savedOutCards, setName) {
	var cardName = card.querySelector("span.print--meta span.print--name").textContent;
	// console.log(cardName);

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

	if(inMatches.length != 0) {
		var container = card.querySelector("span.print--overlay");
		var img = document.createElement("img");
		var iconURL = chrome.extension.getURL("/images/down-circular-32.png");

		img.style = 'height: 20px !important; width: 20px !important; position: absolute; left: 3%; top: 3%; z-index: 4; cursor: default;';
		img.src = iconURL;
		img.class = "icon";
		if(inMatches.length > 1) {
			img.title = "You have " + inMatches.length + " copies in trades";
			img.src = chrome.extension.getURL("/images/down-circular-32-indicator.png");
		}
		container.after(img);
	}
	if(outMatches.length != 0) {
		var container = card.querySelector("span.print--overlay");
		var img = document.createElement("img");
		var iconURL = chrome.extension.getURL("/images/up-circular-32.png");

		img.style = 'height: 20px !important; width: 20px !important; position: absolute; left: 3%; top: 3%; z-index: 4; cursor: default;';
		img.src = iconURL;
		if(outMatches.length > 1) {
			img.title = "You have " + outMatches.length + " copies in trades";
			img.src = chrome.extension.getURL("/images/up-circular-32-indicator.png");
		}
		if(inMatches.length == 0) {
			container.after(img);
		}
		else {
			var existingIcon = card.querySelector("img.icon");
			existingIcon.before(img);
		}
	}
}

function addTradeIndicator(card, savedInCards, savedOutCards) {
	var image = card.querySelector("div.piece-image img.asset");
	var type = "image";
	if(image == null) {
		image = card.querySelector("div.piece-video video.asset");
		type = "video";
	}

	
	// console.log(savedInCards);
	// console.log(savedOutCards);
	var inMatches = [];
	for(var i = 0; i < savedInCards.length; i++) {
		for(var j = 0; j < savedInCards[i]["images"].length; j++) {
			if(type == "image") {
				if(image.src == savedInCards[i]["images"][j]) {
					inMatches.push(savedInCards[i]);
				}
			}
			else {
				if(image.querySelector("source").src == savedInCards[i]["images"][j]) {
					inMatches.push(savedInCards[i]);
				}
			}
		}
	}
	var outMatches = [];
	for(var i = 0; i < savedOutCards.length; i++) {
		for(var j = 0; j < savedOutCards[i]["images"].length; j++) {
			if(type == "image") {
				if(image.src == savedOutCards[i]["images"][j]) {
					outMatches.push(savedOutCards[i]);
				}
			}
			else {
				if(image.querySelector("source").src == savedOutCards[i]["images"][j]) {
					outMatches.push(savedOutCards[i]);
				}
			}
		}
	}

	if(inMatches.length != 0) {
		var container = card.querySelector("div.piece-image");
		if(container == null) {
			container = card.querySelector("div.piece-video");
		}
		var img = document.createElement("img");
		var iconURL = chrome.extension.getURL("/images/down-circular-32.png");

		img.style = 'height: 20px !important; width: 20px !important; position: absolute; right: 3%; bottom: 3%; z-index: 4';
		img.src = iconURL;
		img.class = "icon";
		if(inMatches.length > 1) {
			img.title = "You have " + inMatches.length + " copies in trades";
			img.src = chrome.extension.getURL("/images/down-circular-32-indicator.png");
		}
		container.before(img);
	}
	if(outMatches.length != 0) {
		var container = card.querySelector("div.piece-image");
		if(container == null) {
			container = card.querySelector("div.piece-video");
		}
		var img = document.createElement("img");
		var iconURL = chrome.extension.getURL("/images/up-circular-32.png");

		img.style = 'height: 20px !important; width: 20px !important; position: absolute; right: 3%; bottom: 3%; z-index: 4';
		img.src = iconURL;
		if(outMatches.length > 1) {
			img.title = "You have " + outMatches.length + " copies in trades";
			img.src = chrome.extension.getURL("/images/up-circular-32-indicator.png");
		}
		if(inMatches.length == 0) {
			container.before(img);
		}
		else {
			var existingIcon = card.querySelector("img.icon");
			existingIcon.before(img);
		}
	}
	// console.log(inMatches);
	// console.log(outMatches);
}

async function waitForTrades(window) {
	await waitForElement(window, "ul.user-status--list");
	findTradeIds();
}

window.onload = function() {
	console.log("Page loaded!");
	// waitForTrades(document);
	forAllElements(document, "div.nm-modal.trade", waitToAddIndicatorsTradePage);
	forAllElements(document, "div.nm-set-window", waitToAddIndicatorsCollectionPage);
}