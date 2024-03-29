const all_incidents_map = new Map();
const max_num_markers = 250;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);
const inc_str = urlParams.get('inc');
console.log('inc_str=' + inc_str);

initial_seen_ids = JSON.parse(localStorage.getItem('seen_ids'));
console.log('initial seen_ids:');
console.log(initial_seen_ids);

const map = L.map('map', {
    preferCanvas: true,
    minZoom: 10,
    maxZoom: 18
});
map.setView([43.1427, -77.6161], 10);
map.zoomControl.setPosition('bottomright');

L.tileLayer('/get_tile/{z}/{x}/{y}', {
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    tileSize: 512,
    zoomOffset: -1,
}).addTo(map);

window.onload = (event) => {
    console.log('page is fully loaded');
    // fetch_last(10);
};

fetch_hours = 3;
console.log('fetching incidents from the last ' + fetch_hours + 'hours..');
fetch(`/incidents/init`)
    .then(response => response.json())
    .then(response => {
        // console.log('since response text:');
        // console.log(response);

        console.log('fetched ' + response.length + ' incident records from the past ' + fetch_hours + ' hours');

        console.log('response stringified:' + JSON.stringify(response));

        // parsed_response = JSON.parse(response)
        // console.log('parsed_response:' + parsed_response)

        for (const message of response) {
            console.log('single message:' + message);

            let message_json_stringified = JSON.stringify(message);
            console.log('message json stringified:' + message_json_stringified);

            let json_message_data = message.data;
            console.log('message_data' + json_message_data);

            process_event_msg(json_message_data);
        }
    });

// direct linking of incidents
if (inc_str != null) {
    console.log('inc_str is not null.. looking up id=' + inc_str);
    fetch('/incidents/id/' + inc_str)
        .then(response => response.json())
        .then(response => {
            console.log('query id = ' + inc_str + '. response=');
            console.log(response);
            load_incident_query(inc_str, response);
        });
}

function load_incident_query(inc_str, query_response) {
    console.log('generating incident obj from query response');

    console.log('query_response=');
    console.log(query_response);

    let geo = query_response.geo.split(",");  // geo is in "lon,lat" format

    // build status object for this new incident
    let status_array = [];
    console.log('empty status array = ');
    console.log(status_array);

    // Status[0] is the newest status
    // Typical order is WAITING, DISPATCHED, ENROUTE, ONSCENE
    // incidents from dispatch rss don't always have all statuses

    if (query_response.hasOwnProperty('WAITING')) {
        console.log('found WAITING in queried data =');
        console.log(query_response.WAITING);
        status_array.unshift(({
            ts: query_response.WAITING,
            status_type: 'WAITING'
        }));
    }
    if (query_response.hasOwnProperty('DISPATCHED')) {
        console.log('found DISPATCHED in queried data =');
        console.log(query_response.DISPATCHED);
        status_array.unshift(({
            ts: query_response.DISPATCHED,
            status_type: 'DISPATCHED'
        }));
    }
    if (query_response.hasOwnProperty('ENROUTE')) {
        console.log('found ENROUTE in queried data =');
        console.log(query_response.ENROUTE);
        status_array.unshift(({
            ts: query_response.ENROUTE,
            status_type: 'ENROUTE'
        }));
    }
    if (query_response.hasOwnProperty('ONSCENE')) {
        console.log('found ONSCENE in queried data =');
        console.log(query_response.ONSCENE);
        status_array.unshift(({
            ts: query_response.ONSCENE,
            status_type: 'ONSCENE'
        }));
    }

    console.log('status array with data = ');
    console.log(status_array);


    console.log('creating incident object..');
    let new_inc_from_query = {
        addr: query_response.addr,
        agency: query_response.agency,
        id: inc_str,
        lat: geo[1],
        lon: geo[0],
        type: query_response.type,
        seen: false,
        status: status_array
    };
    console.log(new_inc_from_query);

    add_new_incident(new_inc_from_query);
    mark_inc_seen(inc_str);
    zoom_to_inc(inc_str);
    open_inc_popup(inc_str);
}

const live_source_delay_ms = 2500;
setTimeout(() => {
    // Starts the live event listener after some time has passed
    console.log('starting live events listener');
    var source_live = new EventSource('/incidents/live');
    source_live.addEventListener('message', function (e) {
        console.log('got live event message:' + e);
        console.log('live event message data:' + e.data);

        let message_json_parsed = JSON.parse(e.data);
        console.log('e.data json parsed:' + message_json_parsed);

        if ('heartbeat' in message_json_parsed) {
            console.log('got heartbeat');
        } else {
            process_event_msg(message_json_parsed);
        }
    }, false);
}, live_source_delay_ms);

function process_event_msg(json_record) {
    // Does the initial processing of an event message (both initial load and live)
    // Checks if it's in the client's event list and adds it if necessary
    // if event already exists, then the new status is added
    console.log('processing event message');
    const new_inc_obj = json_inc_fixup(json_record);

    if (new_inc_obj.dup) {
        // duplicate incident, don't add it to the map
        console.log('ID=' + new_inc_obj.id + ' is a duplicate, not adding to client');
        return 1;
    }

    if (all_incidents_map.has(new_inc_obj.id)) {
        // incident ID already exists, add this updated status to it
        update_inc_status(new_inc_obj);
        return 1;
    }

    console.log('incident not found in all_incidents_map, adding now..');

    // Give incident an empty status object
    let status_obj = {
        ts: new_inc_obj.ts,
        status_type: new_inc_obj.status
    };
    new_inc_obj.status = [];
    new_inc_obj.status.unshift(status_obj);  // add status to incident

    add_new_incident(new_inc_obj);  // adds incident to all_incidents_map
}

function add_new_incident(new_inc) {
    // adds new incident to global all_incidents_map, attaches map marker and places on sidebar list, then plays alert
    console.log('adding new incident to client with ID=' + new_inc.id);

    // check whether the client has previously seen this incident with localStorage
    if (localStorage.getItem("seen_ids") === null) {
        console.log('seen_ids is empty');
    } else {
        let temp_seen_ids = JSON.parse(localStorage.getItem('seen_ids'));
        console.log('previously seen ids =');
        console.log(temp_seen_ids);
        console.log('this id = ');
        console.log(new_inc.id);
        if (temp_seen_ids.includes(new_inc.id)) {
            console.log('incident ID=' + new_inc.id + ' has previously been seen by this client');
            new_inc.seen = true;
        } else {
            console.log('incident ID=' + new_inc.id + ' has never been seen by this client');
            new_inc.seen = false;
        }
    }

    all_incidents_map.set(new_inc.id, new_inc);
    let num_markers = all_incidents_map.size;

    // add marker with popup
    generate_marker(new_inc.id);

    console.log('added new incident. num_markers = ' + num_markers + '. max_num_markers = ' + max_num_markers);

    if (num_markers > max_num_markers) {
        console.log('exceeded maximum number of markers (' + max_num_markers + '), removing the oldest entry.');
        const [oldest_id] = map.keys();
        console.log('oldest id=' + oldest_id); // 👉️ a
        const [oldest_inc] = map.values();
        console.log('oldest inc=' + oldest_inc); // 👉️ 1

        map.removeLayer(oldest_inc.marker);
        all_incidents_map.delete(oldest_id);
        console.log('removed oldest incident with id=' + oldest_id);
    }

    console.log('marker add complete. total markers = ' + all_incidents_map.size);

    console.log('incident added to all_incident_map=');
    console.log(all_incidents_map);

    console.log('adding incident to sidebar');
    add_incident_to_sidebar_list(new_inc.id);
    play_alert();
}

function update_inc_status(inc_obj) {
    // status value is an array of status_items
    let target_id = inc_obj.id;
    console.log('updating marker with id=' + target_id);

    let new_status_item = {
        ts: inc_obj.ts,
        status_type: inc_obj.status
    };

    // get current inc, add new status entry, re-map to updated incident
    let temp_inc = all_incidents_map.get(target_id);
    temp_inc.status.unshift(new_status_item);
    all_incidents_map.set(target_id, temp_inc);

    console.log('marker with updated status=');
    console.log(all_incidents_map.get(target_id));

    update_marker_popup(target_id);
}

function json_inc_fixup(inc) {
    // do all fixups here: string, capitalize, etc
    console.log('putting fixes on raw json incident:');
    console.log(inc);

    // convert strings to bools
    inc.dup = (inc.dup === "1");
    inc.new = (inc.new === "1");

    console.log('returning fixed incident:');
    console.log(inc);
    return inc;
}

function pretty_str_recurse_objects(obj, stop_recurse_keys = [], tab_spacer = '') {
    let str = '';
    for (const [key, val] of Object.entries(obj)) {
        // console.log(`${tab_spacer}recursive_str_generator: key=${key}, value=${val}`);
        if (val instanceof Object) {
            if (stop_recurse_keys.includes(key)) {
                // console.log(`${tab_spacer}recursive_str_generator: stopping recursion on key=${key}`);
                str += `${tab_spacer}${key}::${val}\n`;
            } else {
                // console.log(`${tab_spacer}recursive_str_generator: object found -> recursing...`);
                str += `${tab_spacer}${key}\n`;
                str += pretty_str_recurse_objects(val, stop_recurse_keys, (tab_spacer + '\t'));
            }
        } else {
            // console.log(`${tab_spacer}recursive_str_generator: not obj -> printing key, value`);
            str += `${tab_spacer}${key}::${val}\n`;
        }
    }
    return str;
}


function update_marker_popup(inc_id) {
    console.log('updating marker for inc id=' + inc_id);
    let temp_inc = all_incidents_map.get(inc_id);
    let popup_str = get_popup_html(temp_inc);
    temp_inc.marker.setPopupContent(popup_str);
    all_incidents_map.set(inc_id, temp_inc);
}

function generate_marker(inc_id) {
    console.log('generating marker for inc id=' + inc_id);
    let temp_inc = all_incidents_map.get(inc_id);

    if ('marker' in temp_inc) {
        map.removeLayer(temp_inc.marker);
    }

    let popup_str = get_popup_html(temp_inc);
    let inc_marker;
    if (temp_inc.seen) {
        // non-pulsing marker when seen
        const seen_icon = L.divIcon({
            className: 'seen-icon',
            iconSize: [10, 10]
        });
        inc_marker = L.marker([temp_inc.lat, temp_inc.lon], {
            icon: seen_icon,
            title: inc_id
        });
        console.log('generated SEEN marker with string:' + popup_str);
        console.log(popup_str);
    } else {
        // pulsing marker when never seen
        const pulsingIcon = L.icon.pulse({iconSize: [10, 10], color: 'blue'});
        inc_marker = L.marker([temp_inc.lat, temp_inc.lon], {
            icon: pulsingIcon,
            title: inc_id
        });
        console.log('generated UNSEEN (pulsing) marker with string:' + popup_str);
    }

    const popup_options =
        {
            'maxWidth': '250',
            'className': 'custom_popup'
        };

    inc_marker.bindPopup(popup_str, popup_options);

    temp_inc.marker = inc_marker;
    temp_inc.marker.on('click', markerOnClick).addTo(map);

    temp_inc.marker.setPopupContent(popup_str);
    all_incidents_map.set(inc_id, temp_inc);
}

function get_popup_html(inc) {
    return '<h4 style="text-align: center;"><span style="color: #000000;"><strong>' + inc.type + '</strong></span></h4>\n' +
        '<h5 style="text-align: center;"><span style="color: #323232;">' + inc.addr + '</span></h5>\n' +
        '<h5 style="text-align: center;">ID: ' + inc.id + '</h5>\n' +
        '<h6 style="text-align: center;"><span style="color: #2f1e1e;">' + convert_ts_to_est(inc.status.at(-1).ts) + '</span></h6>\n' +
        '<h5 style="text-align: center;"><a href="https://911mapr.com/?inc=' + inc.id + '">Link to this incident</a></h5>';
}

function convert_ts_to_est(ts) {
    //    example of incoming ts = "2022-04-05 04:13:00"

    // convert to ISO 8601 format
    let split_ts = ts.split(" ");
    const utc_date = split_ts[0] + 'T' + split_ts[1] + 'Z';

    let date = new Date(utc_date);
    let local_date_str = date.toLocaleString();

    local_date_str = local_date_str.replace('T', ' ');
    local_date_str = local_date_str.replace('Z', ' ');

    return local_date_str;

}

//{"ts": "2022-04-05 04:13:00", "id": "ROCE2209500025", "status": "WAITING", "type": "MVA / NO INJURIES", "addr": "W RIDGE RD/RIDGEWAY AVE ROC", "agency": "ROC", "lat": "+43.1944", "lon": "-77.6267"}

const lc = L.control.locate({
    position: 'bottomright',
    strings: {
        title: "Show me where I am, yo!"
    }
}).addTo(map);

// coordinates limiting the map
function getBounds() {
    const southWest = new L.LatLng(42.65, -78.5);
    const northEast = new L.LatLng(43.70, -76.80);
    return new L.LatLngBounds(southWest, northEast);
}

// set maxBounds
map.setMaxBounds(getBounds());

// var boundingBox = L.rectangle(getBounds(), {color: "#ff7800", weight: 1});
// map.addLayer(boundingBox);

// zoom the map to the bounding box
// map.fitBounds(getBounds(), {reset: true});

var county_border_style = {
    "color": "rgba(255,0,30,0.36)",
    "weight": 3,
    "opacity": 0.6,
    "fill": false,
    "dashArray": "10"
};

var county_border_geojson_layer = new L.GeoJSON.AJAX("/static/monroe_county.json", {
    style: county_border_style
});
county_border_geojson_layer.addTo(map);

function toggle_sidebar() {
    var sb_c = document.getElementById("sidebarTest");
    var map_c = document.getElementById("mapTest");
    if (sb_c.style.display === "none") {
        sb_c.style.display = "block";
        if (document.body.clientWidth < 575) {
            map_c.style.height = "auto";
        }
    } else {
        sb_c.style.display = "none";
        if (document.body.clientWidth < 575) {
            map_c.style.height = "100%";
        }
    }
}


// document.getElementById('sidebarContents').innerHTML = '<ol><li>html data</li></ol>';

function incTable_addRow(published, title, id) {
    // Get a reference to the table
    let tableID = 'inc_tbody';
    let tableRef = document.getElementById(tableID);

    // Insert a row at the end of the table
    let newRow = tableRef.insertRow(0);

    // Insert a cell in the row at index 0
    let published_cell = newRow.insertCell(0);
    let published_text = document.createTextNode(published);
    published_cell.appendChild(published_text);

    let title_cell = newRow.insertCell(1);
    let title_text = document.createTextNode(title);
    title_cell.appendChild(title_text);

    let id_cell = newRow.insertCell(2);
    let id_text = document.createTextNode(id);
    id_cell.appendChild(id_text);
}

// Call addRow() with the table's ID
// addRow('inc_tbody');

var sidebar = L.control.sidebar('sidebar').addTo(map);
map.addControl(sidebar);

function get_sidebar_lg_html(id) {
    let inc = all_incidents_map.get(id);
    console.log('generating html for sidebar incident list. inc id=' + id);

    let heading = inc.type + ' at ' + inc.addr;
    let cent = inc.id;
    let sml = inc.lat + ', ' + inc.lon;
    let corn = convert_ts_to_est(inc.status.at(-1).ts);

    return '<a class="list-group-item list-group-item-action flex-column align-items-start"\n' +
        'href="#" onclick="click_inc_in_list(\'' + String(id) + '\')" >\n' +
        '<div class="d-flex w-100 justify-content-between">\n' +
        '<h5 class="mb-1">' + heading + '</h5>\n' +
        '<small>' + corn + '</small>\n' + '</div>\n' +
        '<p class="mb-1">' + cent + '</p>\n' +
        '<small>' + sml + '</small>\n' + '</a>';
}

function markerOnClick(e) {
    // TODO: prevent marker from opening on first click, wait until it's regenerated (if "seen" changes state)
    let clicked_marker_id = this.options.title;
    mark_inc_seen(clicked_marker_id);
    zoom_to_inc(clicked_marker_id);
    open_inc_popup(clicked_marker_id);
}

function click_inc_in_list(id) {
    console.log('clicking on inc with ID=' + id);
    zoom_to_inc(id);
    mark_inc_seen(id);
    open_inc_popup(id);
    // TODO: close incident list on mobile after selecting incident from list
}

function mark_inc_seen(id) {
    console.log('marking ID=' + id + ' as seen');
    let temp_inc = all_incidents_map.get(id);

    if (temp_inc.seen) {
        console.log('WARNING: ID=' + id + ' has already been marked as seen');
    } else {
        temp_inc.seen = true;
        generate_marker(id);

        console.log('putting ID=' + id + ' in localStorage with key "seen_ids"');
        let temp_seen_ids;
        if (localStorage.getItem("seen_ids") === null) {
            console.log('making the first entry in seen_ids');
            temp_seen_ids = [];
        } else {
            temp_seen_ids = JSON.parse(localStorage.getItem('seen_ids'));
            if (temp_seen_ids.includes(id)) {
                console.log('ID=' + id + ' has already been seen, not adding it to localStorage');
                return;
            }
        }
        temp_seen_ids.push(id);
        localStorage.setItem('seen_ids', JSON.stringify(temp_seen_ids));
        console.log('added ID=' + id + ' to localStorage');
    }
}

function open_inc_popup(id) {
    console.log('opening inc popup with ID=' + id);
    let inc = all_incidents_map.get(id);
    inc.marker.openPopup();
}

function zoom_to_inc(id) {
    console.log('zooming to inc with ID=' + id);
    // TODO: Track whether sidebar is open or not, then adjust view accordingly
    let inc = all_incidents_map.get(id);
    let inc_lat_lng = inc.marker.getLatLng();
    let zm_lvl = 13;

    console.log('zooming to inc, inc_lat_lng=');
    console.log(inc_lat_lng);

    map.setView(inc_lat_lng, zm_lvl);
}

var inc_lg_counter = 0;

function add_incident_to_sidebar_list(id) {
    console.log('adding incident to sidebar list with id = ' + id);
    let target_el_query = "incident_list_content";
    document.getElementById(target_el_query).innerHTML = get_sidebar_lg_html(id) + document.getElementById(target_el_query).innerHTML;
}

start_ms = Date.now();

function add_test_inc() {
    let delta_ms = Date.now() - start_ms;
    console.log('delta_ms=');
    console.log(delta_ms);

    let delta_s = delta_ms / 1000;
    let modulo_ms = delta_ms % 1000;
    console.log('modulo_ms=');
    console.log(modulo_ms);

    let test_lat = '43.' + String(modulo_ms);
    let test_lon = '-77.' + String(modulo_ms);
    let geo = test_lon + ', +' + test_lat;

    let test_query_response = {
        "DISPATCHED": "2000-01-01 00:00:00.000000",
        "addr": "TEST ADDRESS, ROC",
        "agency": "TST",
        "geo": geo,
        "type": "TEST"
    };

    let test_id = 'TEST' + String(modulo_ms);

    console.log('generated test incident:');
    console.log(test_query_response);

    load_incident_query(test_id, test_query_response);
}

// const sound_on_toast = bootstrap.Toast.getInstance(document.getElementById('sound_on_toast'));
// const sound_off_toast = bootstrap.Toast.getInstance(document.getElementById('sound_off_toast'));
let muted = 1;

function toggle_mute() {
    if (muted < 1) {
        console.log('muted');
        muted = 1;
        document.getElementById("sound_toggle").className = "fa-solid fa-volume-xmark";
        // sound_off_toast.show()
    } else {
        console.log('unmuted');
        muted = 0;
        document.getElementById("sound_toggle").className = "fa-solid fa-volume-high unmuted";
        // sound_on_toast.show()
    }
}

function play_alert() {
    if (muted < 1) {
        const audio = new Audio(
            'https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
        audio.play();
    } else {
        console.log('volume muted - not playing alert');
    }
}
