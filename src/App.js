import React, { Component } from 'react';

import KustomizeOverlay from "./KustomizeOverlay";
import "./style/index.scss";
import "./App.css";

const API_ENDPOINT = "https://api.kustomize.io";
;

class App extends Component {
  render() {
    return (
        <div id="ship-init-component" className="flex1 flex-column u-minHeight--full u-minWidth--full">
          <div className="flex-1-auto flex-column u-overflow--auto">
            <KustomizeOverlay
              API_ENDPOINT={API_ENDPOINT}
            />
          </div>
        </div>
    );
  }
}

export default App;
