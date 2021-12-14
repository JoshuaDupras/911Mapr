var mymap = L.map('mapid').setView([43.074691, -77.623985], 10);
L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token={accessToken}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    maxZoom: 18,
    id: 'mapbox.mapbox-streets-v8',
    accessToken: 'pk.eyJ1Ijoiam9zaHVhZHVwcmFzIiwiYSI6ImNreDR5enZ2ejI2NWsydnEzMHpiMGQzaTkifQ.1H9rEa9GIAO5ly-aBXkY9g' //ENTER YOUR ACCESS TOKEN HERE
}).addTo(mymap);

mapMarkers = [];



var source = new EventSource('/topic/live_incidents_2h_test'); //ENTER YOUR TOPICNAME HERE
source.addEventListener('message', function(e){

  obj = e

  console.log('Message');
  obj = JSON.parse(e.data);
  console.log(obj);

  console.log(obj.length);

  lat = obj[obj.length - 2];
  console.log(lat);

  lon = obj[obj.length - 1];
  console.log(lon);


  marker = L.marker([lat, lon]).addTo(mymap);
  mapMarkers.unshift(marker);

  if(mapMarkers.length > 100) {
    mymap.removeLayer(mapMarkers[99]);
    mapMarkers.pop();
  }

  console.log(mapMarkers.length);

  console.log('end');

}, false);
