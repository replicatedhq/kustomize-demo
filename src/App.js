import React, { Component } from 'react';

import KustomizeOverlay from "./KustomizeOverlay";
import "./style/index.scss";
import "./App.css";

// TODO: CHANGE ME!
// const API_ENDPOINT = "localhost:4444";

class App extends Component {

  saveKustomizeOverlay = async payload => {

  }

  render() {
    return (
        <div id="ship-init-component" className="flex1 flex-column u-minHeight--full u-minWidth--full">
          <div className="flex-1-auto flex-column u-overflow--auto">
            <KustomizeOverlay
              saveKustomizeOverlay={this.saveKustomizeOverlay}
            />
          </div>
        </div>
    );
  }
}

export default App;
