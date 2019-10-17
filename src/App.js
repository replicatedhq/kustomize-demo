import React, { Component } from 'react';
import bugsnag from '@bugsnag/js'
import bugsnagReact from '@bugsnag/plugin-react'

import KustomizeOverlay from "./KustomizeOverlay";
import KustomizeHeader from "./KustomizeHeader";
import "./style/index.scss";
import "./App.css";

const API_ENDPOINT = "https://api.kustomize.io";

const bugsnagClient = process.env.REACT_APP_BUGSNAG_API_KEY
  ? bugsnag({ apiKey: process.env.REACT_APP_BUGSNAG_API_KEY })
  : null;

if (bugsnagClient) {
  bugsnagClient.use(bugsnagReact, React);
}

class App extends Component {
  render() {
    // Use bugsnag error boundary, or just render children
    // for enclosed component
    const ErrorBoundary = bugsnagClient
      ? bugsnagClient.getPlugin("react")
      : ({children}) => children;

    return (
      <ErrorBoundary>
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
      </ErrorBoundary>
    );
  }
}

export default App;
