chrome.runtime.onMessage.addListener(function(msg, sender) {
	displayMsg(msg.data, msg.type);
});

document.getElementById('btnFind').onclick = function() {
	chrome.tabs.query({currentWindow: true, active: true}, function(tabs) {
		sendTradesMsg(tabs[0]);
	});
};

function sendTradesMsg(activeTabId) {
	chrome.tabs.sendMessage(activeTabId.id, {findTrades: true});
}

function displayMsg(msg, type) {
	var p = document.createElement("p");
	p.textContent = msg;
	if(type == "error") {
		p.style = "text-align: center; color: red;";
	}
	else p.style = "text-align: center;";
	document.getElementById("btnFind").after(p);
}
