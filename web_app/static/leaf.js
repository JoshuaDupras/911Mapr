var map = L.map('mapid', {
    preferCanvas: true
}).setView([43.1566, -77.6089], 11);

var num_markers = 250

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
//    maxZoom: 18,
//    minZoom: 11,
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/streets-v11',
    accessToken: 'pk.eyJ1Ijoiam9zaHVhZHVwcmFzIiwiYSI6ImNreDR5enZ2ejI2NWsydnEzMHpiMGQzaTkifQ.1H9rEa9GIAO5ly-aBXkY9g' //ENTER YOUR ACCESS TOKEN HERE
}).addTo(map);

//map.fitBounds([
//    [43.4, -78.00],
//    [42.9, -77.00]
//]);

mapMarkers = [];

var source = new EventSource('/topic/live_incidents'); // KAFKA TOPIC NAME
source.addEventListener('message', function (e) {

    obj = e

    console.log('Message');
    obj = JSON.parse(e.data);
    console.log(obj);

    console.log(obj.length);

    title = obj[2];
    console.log(title);

    published_time = obj[3];
    console.log(published_time);

    status = obj[6];
    console.log(status);

    lat = obj[obj.length - 2];
    console.log(lat);

    lon = obj[obj.length - 1];
    console.log(lon);

    var pulsingIcon = L.icon.pulse({iconSize: [20, 20], color: 'blue'});
    var marker = L.marker([lat, lon], {icon: pulsingIcon}).addTo(map);

    // marker = L.circleMarker([lat, lon], {
    //   color: '#3388ff'
    // }).addTo(map);

    marker_str = 'Title: ' + title + '<br>Time: ' + published_time + '<br>Status: ' + status;
    console.log(marker_str);
    marker.bindPopup(marker_str).openPopup();
    mapMarkers.unshift(marker);

    if (mapMarkers.length > num_markers) {
        map.removeLayer(mapMarkers[(num_markers - 1)]);
        mapMarkers.pop();
    }

    console.log(mapMarkers.length);

    console.log('end');

}, false);

var lc = L.control.locate({
    position: 'topleft',
    strings: {
        title: "Show me where I am, yo!"
    }
}).addTo(map);

// coordinates limiting the map
function getBounds() {
    const southWest = new L.LatLng(42.70, -78.44);
    const northEast = new L.LatLng(43.50, -77.10);
    return new L.LatLngBounds(southWest, northEast);
}

// set maxBounds
map.setMaxBounds(map.getBounds());

// zoom the map to the polyline
map.fitBounds(getBounds(), {reset: true});

var county_border_style = {
    "color": "#ff0000",
    "weight": 3,
    "opacity": 0.6,
    "fill": false,
    "dashArray": "10"
};

var geojsonLayer = new L.GeoJSON.AJAX("/static/monroe_county.json", {
    style: county_border_style
});
geojsonLayer.addTo(map);