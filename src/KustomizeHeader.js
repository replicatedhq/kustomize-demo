import React, { useState } from "react";
import classNames from "classnames";
import "./KustomizeHeader.scss";

export default function KustomizeHeader(props) {
  const [ navOpen, setNavOpen ] = useState(false);

  const toggleMenu = () => {
    setNavOpen(!navOpen);
  }
  return (
    <header {...props}>
      <nav>
        <div className="container u-position--relative">
          <span
            id="toggleNav"
            onClick={toggleMenu}
            className={classNames("u-show--mobileTablet icon u-cursor--pointer", {
            open: navOpen
          })}></span>
          <ul className="flex justifyContent--spaceBetween alignItems--center nav-list u-position--relative">
            <li>
              <a className="logo-link" href="https://kustomize.io">
                <div className="logo"></div>
              </a>
            </li>
            <li>
              <ul className="header-links">
                <li>
                  <a href="https://kubectl.docs.kubernetes.io/pages/app_management/introduction.html" className="header-link">
                    kubectl Usage
                  </a>
                </li>
                <li>
                  <a href="hhttps://github.com/kubernetes-sigs/kustomize/blob/master/docs" className="header-link">
                    Core Docs
                  </a>
                </li>
                <li>
                  <a href="https://kustomize.io/#overview" className="header-link">
                    Overview
                  </a>
                </li>
                <li>
                  <a href="https://kustomize.io/#resources" className="header-link">
                    Resources
                  </a>
                </li>
                <li>
                  <a href="https://kustomize.io/#community" className="header-link">
                    Community
                  </a>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}