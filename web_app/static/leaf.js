var map = L.map('mapid', {
    preferCanvas: true
}).setView([43.1566, -77.6089], 11);

var num_markers = 500

L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    minZoom: 11,
    tileSize: 512,
    zoomOffset: -1,
    id: 'mapbox/streets-v11',
    accessToken: 'pk.eyJ1Ijoiam9zaHVhZHVwcmFzIiwiYSI6ImNreDR5enZ2ejI2NWsydnEzMHpiMGQzaTkifQ.1H9rEa9GIAO5ly-aBXkY9g' //ENTER YOUR ACCESS TOKEN HERE
}).addTo(map);

map.fitBounds([
    [43.4, -78.00],
    [42.9, -77.00]
]);

mapMarkers = [];

var source = new EventSource('/topic/live_incidents'); // KAFKA TOPIC NAME
source.addEventListener('message', function(e){

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

  marker = L.circleMarker([lat, lon], {
    color: '#3388ff'
  }).addTo(map);
  marker_str = 'Title: ' + title + '<br>Time: ' + published_time + '<br>Status: ' + status
  console.log(marker_str)
  marker.bindPopup(marker_str).openPopup();
  mapMarkers.unshift(marker);

  if(mapMarkers.length > num_markers) {
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
  const southWest = new L.LatLng(42.930000, -78.000000);
  const northEast = new L.LatLng(43.377000, -77.370000);
  return new L.LatLngBounds(southWest, northEast);
}

// set maxBounds
map.setMaxBounds(map.getBounds());

// zoom the map to the polyline
//map.fitBounds(getBounds(), { reset: true });

//var district_boundary = new L.geoJson();
//district_boundary.addTo(map);
//
//$.ajax({
//dataType: "json",
//url: "data/monroe_county.geojson",
//success: function(data) {
//    $(data.features).each(function(key, data) {
//        district_boundary.addData(data);
//    });
//}
//}).error(function() {});

var geojsonLayer = new L.GeoJSON.AJAX("/static/monroe_county.json");
geojsonLayer.addTo(map);