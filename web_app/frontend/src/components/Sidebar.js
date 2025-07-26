import React, { useState } from 'react';
import '../App.css';

function Sidebar() {
  const [activeTab, setActiveTab] = useState('home');

  return (
    <div className="sidebar collapsed" id="sidebar">
      <div className="sidebar-tabs">
        <ul role="tablist">
          <li>
            <a href="#home" role="tab" onClick={() => setActiveTab('home')}><i className="sidebar-icon fa-solid fa-circle-info" title="About 911Mapr"></i></a>
          </li>
          <li>
            <a href="#incident_list" role="tab" onClick={() => setActiveTab('incident_list')}><i className="sidebar-icon fa-solid fa-list" title="Live Incident List"></i></a>
          </li>
          <li className="disabled">
            <a href="https://twitter.com/911mapr_roc" target="_blank" rel="noopener noreferrer" role="tab"><i className="fa-brands fa-twitter" title="Live Twitter Feed"></i></a>
          </li>
          <li className="disabled">
            <a href="#" role="tab"><i className="sidebar-icon fa-solid fa-volume-xmark" id="sound_toggle" title="Volume"></i></a>
          </li>
        </ul>
        <ul role="tablist">
          <li>
            <a href="https://github.com/JoshuaDupras/911Mapr" role="tab" target="_blank"><i className="sidebar-icon fa-brands fa-github"></i></a>
          </li>
          <li>
            <a href="#settings" role="tab" onClick={() => setActiveTab('settings')}><i className="sidebar-icon fa fa-gear"></i></a>
          </li>
        </ul>
      </div>
      <div className="sidebar-content">
        {activeTab === 'home' && (
          <div className="sidebar-pane" id="home">
            <h1 className="sidebar-header">About:<span className="sidebar-close"><i className="fa fa-caret-left"></i></span></h1>
            <h4 className="about_head">911Mapr is a Live Map of 911 Incidents Across Monroe County, NY. (Rochester)</h4>
            <p className="about_head"> Data Sourced from <a href="https://www.monroecounty.gov/safety-incidents">Monroe County Dispatch</a></p>
            <p className="about_link">
              <a href="https://twitter.com/911mapr_roc" target="_blank" rel="noopener noreferrer">
                <span className="btn btn-primary btn-large disabled">
                  <i className="fa-brands fa-twitter about-link-icon"></i> Follow the Live Twitter Feed -&gt; @911mapr_roc
                </span>
              </a>
            </p>
            <p className="warning">Disclaimer: Not affiliated with any government entity. Data accuracy is not guaranteed. Use at your own risk.</p>
          </div>
        )}
        {activeTab === 'incident_list' && (
          <div className="sidebar-pane" id="incident_list">
            <h1 className="sidebar-header" id="incident_list_header">Live Incident List<span className="sidebar-close"><i className="fa fa-caret-left"></i></span></h1>
            <div className="list-group list-group-flush border-bottom scrollarea" id="incident_list_content">
              {/* Incidents will be rendered here by MapView */}
            </div>
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="sidebar-pane" id="settings">
            <h1 className="sidebar-header">Settings<span className="sidebar-close"><i className="fa fa-caret-left"></i></span></h1>
            <button onClick={() => window.dispatchEvent(new Event('addTestIncident'))}>Add Test Incident</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Sidebar;
