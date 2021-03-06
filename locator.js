/*
=============================
Initialize main variables
==============================
*/

var mainMap;				 //Main Google map variable
var	earthR = 6371;  		 //Mean radius of Earth (km)
var	mapMarkers = [];		 //Store primary and secondary map markers
var	searchRadii = [];		 //Store search radius circle
var factualMaxRadius = "6";  //Maximum user-specified search radius for use with Factual.com API
var	coordDecimals = 7;		 //Number of Map and Marker Lat & Lng decimal places
var distDecimals = 3;		 //Number of calculated distance decimal places
var	ajaxResponse;			 //Variable to store Ajax call response from Factual.com API 	
var	secureKeys = apiKeys();	 //Store Google Javascript API and Factual.com API keys
var	tableEntry;				 //Variable used in constructing page results table

/*
=============================
Dynamically insert script to
call Google map initialization
function
==============================
*/

var mapScript = document.createElement('script');

mapScript.setAttribute("id", "loadmain");

mapScript.setAttribute('src', 
	"https://maps.googleapis.com/maps/api/js?key=" + 
	secureKeys[0] + "&callback=initMap");

mapScript.async = true;
mapScript.defer = true;

document.body.appendChild(mapScript);

//==============================

function initMap() {

	/*
	==============================
	Map centered on Washington, D.C.
	with main map controls active
	==============================
	*/

	var	mapDiv = document.getElementById('map');

	var mapOptions = {

	center: new google.maps.LatLng(38.889931, -77.009003),

	zoom: 10,

	zoomControl: true,

	mapTypeControl: true,

	scaleControl: true,

	streetViewControl: true,

	mapTypeId: google.maps.MapTypeId.HYBRID

	};


	//Geocoder used later for country code extraction
	var geoCodeInfo = new google.maps.Geocoder;	

	mainMap = new google.maps.Map(mapDiv, mapOptions);

	setElement("id", "lat", mapOptions.center.lat());
	setElement("id", "lng", mapOptions.center.lng());

	/*
	=============================
	Valid world map coordinate system 
	bounds (SW corner, NE corner)
	==============================
	*/

	var worldBounds = new google.maps.LatLngBounds(
		new google.maps.LatLng(85, -180),
		new google.maps.LatLng(-85, 180)
	);

	/*
	============================
	Keep map within standard
	world latitude/longitude bounds
	Latitude:  +/- 85  degrees
	Longitude: +/- 180 degrees
	==============================
	*/

	google.maps.event.addListener(mainMap, "bounds_changed", function() {

		if (worldBounds.contains(mainMap.getCenter())) return;

		var mapCenter = mainMap.getCenter();
		var mapLat = mapCenter.lat();
		var mapLng = mapCenter.lng();

		var maxLat = worldBounds.getSouthWest().lat();
		var minLat = worldBounds.getNorthEast().lat();
		
		var maxLng = worldBounds.getNorthEast().lng();
		var minLng = worldBounds.getSouthWest().lng();

		if (mapLat < minLat) mapLat = minLat;
		if (mapLat > maxLat) mapLat = maxLat;
		if (mapLng < minLng) mapLng = minLng;
		if (mapLng > maxLng) mapLng = maxLng;

		mainMap.setCenter(new google.maps.LatLng(mapLat, mapLng));

	});

	/*
	==============================
	Search box entry will snap
	primary map marker to entered
	location using addressLatLng
	==============================
	*/

	var searchGeocoder = new google.maps.Geocoder();
	var searchButton = document.getElementById("search-btn");
	var addressInput = document.getElementById("address");

	searchButton.addEventListener('click', function() {

		addressLatLng(searchGeocoder, mainMap);

	});

	/*
	==============================
	User may press Enter key to 
	center map on location specified
	within map search box.  The
	function addressLatLng provides 
	the location coordinates.
	==============================
	*/

	addressInput.addEventListener('keyup', function(keyStroke) {

		keyStroke.preventDefault();

		if (keyStroke.keyCode === 13) {

			searchButton.click();

		}

	}); 

	function addressLatLng(geoEntry, primeMap) {

		var searchAddress = getElement("id", "address");

		geoEntry.geocode({'address' : searchAddress}, function(results, status) {

			if (status === google.maps.GeocoderStatus.OK) {

				primeMap.setCenter(results[0].geometry.location);

				locationMarker.position = primeMap.getCenter();
				locationMarker.setMap(primeMap);

				markerSetPosition();

				google.maps.event.trigger(locationMarker, 'click');
			
			}else {

				alert('Geocoder unsuccessful due to: ' +  status);
			}

		});

	};

	/*
	==============================
	Map center change displays
	latitude and longitude
	==============================
	*/

	google.maps.event.addListener(mainMap, "center_changed", function() {

		var latOutput = mainMap.getCenter().lat().toFixed(coordDecimals);
		var lngOutput = mainMap.getCenter().lng().toFixed(coordDecimals);

		setElement("id", "lat", latOutput);
		setElement("id", "lng", lngOutput);

	});

	/*
	============================
	Initial map marker location
	set to map center
	==============================
	*/

	locationMarker = new google.maps.Marker({
				map: mainMap,
				draggable: true,
				position: mainMap.getCenter(),
				icon: "https://maps.google.com/mapfiles/kml/pal3/icon20.png"
			});

	mapMarkers.push(locationMarker);


	/*
	============================
	Marker position change displays
	latitude and longitude
	==============================
	*/
	
	setElement("id", "marklat", mapOptions.center.lat());
	setElement("id", "marklng", mapOptions.center.lng());	

	google.maps.event.addListener(locationMarker, "drag", function() {

		markerSetPosition();

	});

	/*============================
	Ensure map marker maintains its
	position at center of map, when
	user finishes dragging the map
	to a new location
	==============================*/

	function markerSnapToMapCenter() {

		locationMarker.position = mainMap.getCenter();
		locationMarker.setMap(mainMap);	

		mapMarkers.push(locationMarker);

		markerSetPosition();

	};

	google.maps.event.addListener(mainMap, "dragend", function() {
		
		markerSnapToMapCenter();
	
	});

	google.maps.event.addListener(locationMarker, "dragend", function() {
		
		mainMap.setCenter(locationMarker.getPosition());

	});

	/*
	============================
	Primary map marker click event 
	displays search radius circle
	and initiates AJAX request to
	Factual.com API
	==============================
	*/

	google.maps.event.addListener(locationMarker, "click", function() {

		if (document.getElementById('restable')) {

			document.getElementById('datatable').innerHTML = '';

		}

		removeFromMap(mapMarkers);
		removeFromMap(searchRadii);

		searchRadii = [];

		//Enforce search radius numeric limits

		var currentSearchRadius = getElement("id", "rad_input");

		if (currentSearchRadius === "0") {

			setElement("id", "rad_input", "1");

		}else if (Number(currentSearchRadius) > Number(factualMaxRadius)) {

			setElement("id", "rad_input", factualMaxRadius);

		}

		var searchRadius = new google.maps.Circle({

			map: mainMap,
			radius: milesToMeters(getElement("id", "rad_input")),
			fillColor: '#AA0000'

		});

		searchRadii.push(searchRadius);
		searchRadius.bindTo('center', locationMarker, 'position');

		locationMarker.position = mainMap.getCenter();
		locationMarker.setMap(mainMap);

		var searchLat = getElement("id", "marklat");
		var	searchLng = getElement("id", "marklng");
		var	factualParams;
		var	factualUrl;
		var	factualRadius = searchRadius.radius;
			

		var geoLatLng = {lat: parseFloat(searchLat), lng: parseFloat(searchLng)},
			countryCode;

		//Find places according to country code (e.g. "us")

		geoCodeInfo.geocode({'location': geoLatLng}, function req(results, status) {

			if (status === google.maps.GeocoderStatus.OK) {

				var resultsLen = results.length;
				var res;

				for (res = 0; res < resultsLen; res++) {

					if (results[res].types.indexOf("country") !== -1) {

						countryCode = results[res].address_components[0]
						.short_name.toLowerCase();
						break;
					}

				}

			} else {

				//Retry call to Google Geocoding API after brief delay

				if (status === google.maps.GeocoderStatus.OVER_QUERY_LIMIT) {

					setTimeout(function() {

						req(results, status);

					}, 200);

				} else {

					return;
				}

			}

			//Country code (if exists) used to retrieve location data from Factual.com API
			if (countryCode) {

				factualParams = [countryCode, geoLatLng.lat, geoLatLng.lng, factualRadius];
				factualUrl = apiEncodeUrl(factualParams);
				ajaxRequest(factualUrl, buildResultTable);
			}

		});

		mainMap.setCenter(geoLatLng);
		mainMap.setZoom(13);

	});

	/*
	==============================
	Center map using geolocation 
	(if supported by browser)
	==============================
	*/

	getCurrentLocation();

};

function getCurrentLocation() {

	if (navigator.geolocation) {

		navigator.geolocation.getCurrentPosition(showPosition, handleGeolocateError);

	}

};

function handleGeolocateError(errCode) {

	/*
	==============================
	Error Codes:

	1 - Permission denied by user
	2 - Position unavailable
	3 - Network timeout
	============================== 
	*/

	var err;

	switch (errCode.code) {

		case 1:

			err = "Geolocation blocked by user."
			break;

		case 2:

			err = "Geolcation service currently unavailable."
			break;

		case 3:

			err = "Geolocation prevented due to network timeout."
			break;

	}
	
	alert('ERROR(' + errCode.code + '): ' + errCode.message + ".\n" + err);				

};

function showPosition(position) {

	//Snap primary map marker to user's location

	var presentLocation = new google.maps.LatLng(position.coords.latitude,
		position.coords.longitude);

	mainMap.setCenter(presentLocation);

	locationMarker.position = presentLocation;
	locationMarker.setMap(mainMap);

	markerSetPosition();

};

function markerSetPosition() {

	//Display marker coordinates on main page

	var markerLat = locationMarker.getPosition()
					.lat().toFixed(coordDecimals);
	var markerLng = locationMarker.getPosition()
					.lng().toFixed(coordDecimals);

	setElement("id", "marklat", markerLat);
	setElement("id", "marklng", markerLng);

};

function removeFromMap(itemArray) {

	//Remove all map markers from map
	
	var i;

	for (i = 0; i < itemArray.length; i++) {

		itemArray[i].setMap(null);

	}

};

function milesToMeters(radius) {

	return radius * 5280 * (1200 / 3937);

};

function metersToMiles(radius) {

	return radius * (3937 / (1200 * 5280));

}

function greatCircleDistance(lat1, lng1, lat2, lng2) {

	/*
	========================================
	Compute great circle distance from center of 
	search circle to locations discovered in 
	database that fall within search radius bounds
	======================================== 
	*/

	var coordsArray = Array.prototype.slice.call(arguments),
		convertedCoords,
		deltaLng,
		sinProduct,
		cosProduct, dist;

	convertedCoords = coordsArray.map(function(num) {
		return degreesToRadians(num);
	});

	deltaLng = Math.cos(convertedCoords[3] - convertedCoords[1]);

	sinProduct = Math.sin(convertedCoords[0]) * 
				Math.sin(convertedCoords[2]);

	cosProduct = Math.cos(convertedCoords[0]) *
				Math.cos(convertedCoords[2]);

	dist = Math.acos(sinProduct + cosProduct * deltaLng) * earthR;

	return (dist * 1000);

};


function degreesToRadians(coordinate) {

	return coordinate * Math.PI / 180;

};

function radiansToDegrees(coordinate) {

	return coordinate * 180 / Math.PI;

};

function ajaxRequest(url, callback) {

	/*
	========================================
	Send a data request to server hosting the
	API of interest.  Cross browser compatibility
	checks are included, should older browsers
	be in use (see actxVersions).
	======================================== 
	*/

	var xhttpR;

	if (typeof XMLHttpRequest !== 'undefined') {

		xhttpR = new XMLHttpRequest();

	}else {

		var actxVersions = ["MSXML2.XmlHttp.5.0",
							"MSXML2.XmlHttp.4.0",
							"MSXML2.XmlHttp.3.0",
							"MSXML2.XmlHttp.2.0",
							"Microsoft.XmlHttp"
							];

		var i;
		var actxArrLen = actxVersions.length;

		for (i = 0; i < actxArrLen; i++) {

			try {

				xhttpR = new ActiveXObject(actxVersions[i]);
				break;

			} catch(error) {

				alert('ActiveX not enabled in this browser; enable ActiveX');

			}
		}
	}

	/*
	========================================
	Check server readiness to respond to
	data request.  An "OK" status will invoke
	the specified callback function to handle
	the returned data
	======================================== 
	*/

	xhttpR.onreadystatechange = checkReadiness;

	function checkReadiness() {

		/*
		========================================
		 XMLHttpRequest object readyState properties:

		 0: request not initialized
		 1: server connection established
		 2: request received
		 3: processing request
		 4: request finished and response ready

		 200: status "OK"
		 404: status "Page not found"
		========================================
		*/

		if (xhttpR.readyState < 4) {

			return;

		}

		if (xhttpR.status !== 200) {

			return;

		}

		if (xhttpR.readyState == 4) {

			return callback(xhttpR.responseText);

		}
	}

	//Send query url to API server

	xhttpR.open('GET', url, true);
	xhttpR.send('');

};

function processAjaxResponse(response) {

	/*
	========================================
	Handle returned JSON data from Factual.com
	API server data request
	======================================== 
	*/

	response = JSON.parse(response);

	return response.response.data;

};

function buildResultTable(response) {

	//Generate location results table on main page

	var infoArray = processAjaxResponse(response);

	var table = document.createElement('table');
	var tableProperties;

	document.getElementById('datatable').appendChild(table);

	var tableProperties = {"id" : "restable", "cellspacing" : 0,
						   "border" : "1"};

	setElementAttributes(table, tableProperties);

	var headerValues = {

						"Name"             : "name", 
						"Address"          : "address", 
						"Suite"            : "address_extended", 
						"City"             : "locality",
						"Phone"            : "tel", 
						"Website"  	       : "website", 
						"Distance (miles)" : "$distance"

					   };

	tableCells(table, [headerValues, {}], 'head');

	var tBody = document.createElement('tbody');

	tableCells(tBody, [headerValues, infoArray], 'body');

	document.getElementById('restable').appendChild(tBody);

};

function setElementAttributes(el, attribs) {

	/*
	========================================
	attribs is an object containing attributes 
	to apply to the DOM element, el, 
	via the chosen method
	========================================
	*/

	for (key in attribs) {

		el.setAttribute(key, attribs[key]);

	}

};

function setElement(type, name, value) {

	//Set values of DOM elements to desired value

	switch (type) {

		case "id":
			document.getElementById(name).value = value;
			break;

		case "class":
			document.getElementsByClassName(name).value = value;
			break;

		case "tag":
			document.getElementsByTagName(name).value = value;
			break;

	}

};

function getElement(type, name) {

	//Retrieve DOM element values

	switch (type) {

		case "id":
			return document.getElementById(name).value;
			break;

		case "class":
			return document.getElementsByClassName(name).value;
			break;

		case "tag":
			return document.getElementsByTagName(name).value;
			break;

	}

};

function tableCells(tableSeg, cellValues, type) {

	//Parse and display results table entries

	var headers = cellValues[0];
	var headKeys = Object.keys(cellValues[0]);
	var headLen = headKeys.length;

	switch (type) {
		
		case 'head':

			var i; 
			var j;
			
			var tHead = tableSeg.createTHead();
			var row = tHead.insertRow(-1);
			var headCell;

			for (i = 0; i < headLen; i++) {

				headCell = document.createElement("TH");

				headCell.innerHTML = headKeys[i];

				row.appendChild(headCell);

			}

		break;

		case 'body':

			var info = cellValues[1];
			var uniquePhone = [];

				/*
				========================================
				Tabulated results sorted by distance
				(ascending order) and without repeated
				entries.  Results will all be within
				the specified search radius.
				========================================
				*/

				info = info.sort(function(first, second) {

					return first.$distance - second.$distance;

				})

				info = info.filter(function(obj) {

					if (obj.hasOwnProperty("locality") && 
						uniquePhone.indexOf(obj.tel) === -1 &&
						Number(getElement("id", "rad_input")) 
						>= metersToMiles(obj.$distance)) {

						uniquePhone.push(obj.tel);

						return obj;

					}

				});

			var	infoLen = info.length;
			var keyName;
			var	row;
			var mapWindow = [];

			for (i = 0; i < infoLen; i++) {

				row = tableSeg.insertRow(i);
				setElementAttributes(row, {"id" : String(i)});

				for (j = 0; j < headLen; j++) {

					tableEntry = row.insertCell(j);

					keyName = headers[headKeys[j]];

					if (info[i].hasOwnProperty(keyName)) {

						switch (keyName) {

							case 'website':

								tableEntry.innerHTML = '<a target="_blank" href=' + "\"" +
								info[i][keyName] + "\"" + '>' + info[i][keyName] + 
								'</a>';

							break;

							case '$distance':

								var lat1 = Number(getElement("id", "marklat"));
								var lng1 = Number(getElement("id", "marklng"));
								var lat2 = info[i].latitude;
								var lng2 = info[i].longitude;

								/*
								========================================
								Map marker information box functionality.
								Box consists of business name and hours
								(if available)
								========================================
								*/

								var boxTitle = '<h2 id="boxtitle">' + info[i].name + '</h2>';

								if (info[i].hasOwnProperty('hours_display')) {

									var businessHours = info[i].hours_display;
									businessHours = businessHours.split(';');
									businessHours = businessHours.join('</br>');

									mapWindow[i] = new google.maps.InfoWindow({
										content: boxTitle + '</br>' + '<div id="hours">' 
												+ businessHours + '</div>'
									});

								}else {

									mapWindow[i] = new google.maps.InfoWindow({
										content: boxTitle + '</br>' + '<div id="hours">' 
												+ 'See website or call for business hours'
												+ '</div>'
									});

								}

								mapMarkers[i] = new google.maps.Marker({
									map: mainMap,
									icon: "pizza.png",
									position: new google.maps.LatLng(lat2, lng2),
									title: info[i].name
								});

								/*
								========================================
								Closures necessary to ensure an infowindow
								is associated with its intended map marker. 
								======================================== 
								*/
								google.maps.event.addListener(mapMarkers[i], 'mouseover', function(refKey) {
									return function() {
										mapWindow[refKey].open(mainMap, mapMarkers[refKey]);
										document.getElementById(String(refKey)).scrollIntoView(true);
										document.getElementById(String(refKey)).style.backgroundColor = "#0B0";
									};
								}(i));

								google.maps.event.addListener(mapMarkers[i], 'mouseout', function(refKey) {
									return function() {
										mapWindow[refKey].close(mainMap, mapMarkers[refKey]);
										document.getElementById(String(refKey)).removeAttribute("style");
									};
								}(i));

								var gcDistance = greatCircleDistance(lat1, lng1, lat2, lng2);

								tableEntry.innerHTML = 
									metersToMiles(gcDistance).toFixed(distDecimals);

							break;

							default:

								tableEntry.innerHTML = info[i][keyName];
						}

					}else {

						tableEntry.innerHTML = '';
					}
				}


			}

			break;
	}

};

function apiEncodeUrl(params) {

	/*
	========================================
	Properly encode special characters in
	url used to make API calls.  Utilize
	Cross Origin Resource Sharing (CORS)
	proxy (crossorigin.me) to prevent call
	to Factual.com API from being blocked by
	browser.
	======================================== 
	*/

	var first,        country,   
		filter,       category,  
		geo,          radius,    
		resultLimit,  factualKey,   
		urlParts;

	first = 'https://crossorigin.me/http://api.v3.factual.com/t/places-',
	country = params[0],
	filter = '?filters=',
	category = '{"category_ids":{"$includes":363}}',

	geo = '&geo={"$circle":{"$center":[' + params[1] + ',' +
		   params[2] + '],',

	radius = '"$meters"' +  ':' +  params[3] + '}}',
	resultLimit = '&limit=50',
	factualKey = '&KEY=' + secureKeys[1];

	urlParts = [first,       country, 
				filter,      category, 
				geo,         radius,
				resultLimit, factualKey
			   ];

	return encodeURI(urlParts.join(''));

};

function validNumericInput(event) {

	/*
	========================================
	validNumericInput restricts search
	radius input box into accepting
	only numbers and certain
	keyboard key actions
	========================================
	*/

	//Cross-browser key code extraction method selection

	var key = (event.which) ? event.which : event.keyCode;

		//Numbers 0-9
	if (key >= 48 && key <= 57   ||
		//Numbers 0-9 (keypad)
		key >= 96 && key <= 105  ||
		//Delete and Back Space keys
		key === 46 || key === 8 ||
		//Left and Right arrow keys
		key === 37  || key === 39)  {

		return true;

		//Period key check (keyboard 110; keypad: 190)
	}else if (key === 110 || key === 190) {

		//Ensure only one period allowed in input box
		if ((document.getElementById('rad_input').value)
			.indexOf('.') === -1) {
			
			return true;

		}

	}

	return false;

};