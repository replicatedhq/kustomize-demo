import React, { Component } from 'react';

import KustomizeOverlay from "./KustomizeOverlay";
import KustomizeHeader from "./KustomizeHeader";
import "./style/index.scss";
import "./App.css";

const API_ENDPOINT = "https://api.kustomize.io";

class App extends Component {
  render() {
    return (
      <div className="kustomize-root flex-column flex1 u-minHeight--full u-minWidth--full">
        <KustomizeHeader className="kustomize-header flex-column" />
        <div id="ship-init-component" className="flex1 flex-column">
          <div className="flex-1-auto flex-column u-overflow--auto">
            <KustomizeOverlay
              API_ENDPOINT={API_ENDPOINT}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default App;
