import React, { Component } from "react";
import AceEditor from "react-ace";

import DiffEditor from "./DiffEditor";
import { AceEditorHOC } from "./AceEditorHOC";
import find from "lodash/find";
import findIndex from "lodash/findIndex";
import FileTree from "./FileTree";
import KustomizeModal from "./KustomizeModal";

import "brace/mode/yaml";
import "brace/theme/chrome";

// const PATCH_OVERLAY = "PATCH";
const BASE_OVERLAY = "BASE";
const RESOURCE_OVERLAY = "RESOURCE";

export default class BespokeKustomizeOverlay extends Component {
  constructor(props) {
    super(props);

    this.state = {
      files: [],
      savedOverlays: [],
      addingNewResource: false,
      lastSavedPatch: null,
      patch: "",
      finalized: "",
      newResourceName: "",
      savingFinalize: false,
      selectedFile: "",
      selectedFileContent: null,
      showDiff: false,
      overlayToDelete: "",
      dataLoading: false,
      displayConfirmModal: false,
      displayConfirmModalMessage: "",
      displayConfirmModalDiscardMessage: "",
      displayConfirmModalSubMessage: "",
      modalAction: this.discardOverlay,
    };

    this.addResourceWrapper = React.createRef();
  }

  getFile = (path, array) => {
    const { files } = this.state;
    let searchArray = array || [...files];

    for (const file of searchArray) {
      if (path === file.path) {
        return file;
      } else if (file.children && file.children.length) {
        return this.getFile(path, file.children);
      }
    }
  }

  resetState = async () => {
    this.setState({
      patch: "",
      finalized: "",
      showDiff: false,
      selectedFile: "",
      selectedFileContent: "",
      strippedOriginal: ""
    });

  }

  getOverlay = path => {
    const { savedOverlays } = this.state;
    const overlay = savedOverlays.find(o => {
      return o.path === path;
    });

    return overlay;
  }

  setSelectedFile = async (path) => {
    const { lastSavedPatch, patch, selectedFile } = this.state;
    /* eslint-disable-next-line no-restricted-globals */
    let canChangeFile = !lastSavedPatch || patch === lastSavedPatch || confirm("You have unsaved changes in the patch. If you proceed, you will lose any of the changes you've made.");
    const overlay = this.getOverlay(path);

    if (selectedFile !== path) {
      // A new file has been selected. Reset all the things
      await this.resetState();
    }
    if (canChangeFile) {
      this.setState({ selectedFile: path, lastSavedPatch: null }, () => {
        const file = this.getFile(path);
        if (!file) { return; }
        this.setState({
          selectedFileContent: file.content
        });
        if (overlay) {
          this.setState({
            patch: overlay.patch
          }, () => {
            this.applyPatchAndOpen();
          });
        }
      });
    }
  }

  toggleModalForExcludedBase = (basePath) => {
    this.setState({
      displayConfirmModal: !this.state.displayConfirmModal,
      displayConfirmModalMessage: "Are you sure you want to include this base resource?",
      displayConfirmModalDiscardMessage: "Include base",
      displayConfirmModalSubMessage: "It will be included in the kustomization.yaml file that is generated for you.",
      modalAction: () => (this.includeBase(basePath)),
    });
  }

  toggleModal = (overlayPath, overlayType) => {
    const displayConfirmModalSubMessage = "It will not be applied to the kustomization.yaml file that is generated for you.";
    let displayConfirmModalMessage = "Are you sure you want to discard this patch?";
    let displayConfirmModalDiscardMessage = "Discard patch";

    if (overlayType === BASE_OVERLAY) {
      displayConfirmModalMessage = "Are you sure you want to discard this base resource?";
      displayConfirmModalDiscardMessage = "Discard base";
    } else if (overlayType === RESOURCE_OVERLAY) {
      displayConfirmModalMessage = "Are you sure you want to discard this resource?";
      displayConfirmModalDiscardMessage = "Discard resource";
    }

    this.setState({
      displayConfirmModal: !this.state.displayConfirmModal,
      overlayToDelete: this.state.displayConfirmModal ? "" : overlayPath,
      displayConfirmModalMessage,
      displayConfirmModalDiscardMessage,
      displayConfirmModalSubMessage,
      modalAction: () => (this.discardOverlay(overlayType)),
    });
  }

  discardOverlay = async (overlayType) => {
    const { overlayToDelete } = this.state;
    await this.deleteOverlay(overlayToDelete, overlayType);
    this.setState({
      patch: "",
      displayConfirmModal: false,
      lastSavedPatch: null
    });
  }

  deleteOverlay = async (path, overlayType) => {
    const { fileTree, selectedFile } = this.state;
    const isResource = overlayType === RESOURCE_OVERLAY;
    const isBase = overlayType === BASE_OVERLAY;
    const overlays = find(fileTree, { name: "overlays" });
    const overlayExists = overlays && findIndex(overlays.children, { path }) > -1;

    // TODO: Handle deletion of generated overlays here
    if (isResource) {
      await this.props.deleteOverlay(path, "resource");
      return;
    }

    if (isBase) {
      if (selectedFile === path) {
        this.setState({ selectedFile: "" });
      }
      await this.props.deleteOverlay(path, "base");
      return;
    }

    if (overlayExists) {
      await this.props.deleteOverlay(path, "patch");
      return;
    }
  }


  handleGeneratePatch = async path => {
    /*
    type Request struct {
		  Original string        `json:"original"`
		  Patch    string        `json:"existing_patch"`
		  Path     []interface{} `json:"path"`
	  }
    */
    const { API_ENDPOINT } = this.props;
    try {
      const resp = await fetch(`${API_ENDPOINT}/kustomize/patch`, {
        method: "POST",
        mode: "cors",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*"
        },
        body: JSON.stringify({
          path,
          original: this.state.selectedFileContent,
          existing_patch: this.state.patch || ""
        })
      });

      const json = await resp.json();
      this.setState({
        patch: json.patch
      });
    } catch (error) {
      console.error(error);
    }
  }

  handlePatchChange = value => {
    this.setState({
      patch: value
    });
  }

  handleApplyPatch = async () => {
    /*
      type Request struct {
        Resource string`json:"resource"`
        Patch    string`json:"patch"`
    } */
    const { API_ENDPOINT } = this.props;

    try {
      const response = await fetch(`${API_ENDPOINT}/kustomize/apply`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resource: this.state.selectedFileContent,
          patch: this.state.patch
        })
      });
      const strippedOriginalResponse = await fetch(`${API_ENDPOINT}/kustomize/apply`, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          resource: this.state.selectedFileContent,
          patch: ""
        })
      });

      const json = await response.json();
      const strippedJson = await strippedOriginalResponse.json();
      this.setState({
        strippedOriginal: strippedJson.modified,
        finalized: json.modified
      });

    } catch (error) {
      throw new Error("We weren't able to apply your patch, please verify your patch and try again.");
    }
  }

  handleKustomizeSave = () => {

  }

  handleAddResourceClick = async () => {
    // Ref input won't focus until state has been set
    this.setState({ addingNewResource: true }, () => {
      this.addResourceInput.current.focus();
    });

    window.addEventListener("click", this.handleClickOutsideResourceInput);
  }

  toggleDiffViewer = () => {
    this.setState({
      showDiff: !this.state.showDiff
    }, () => {
      this.patchAceEditor.editor.resize();
    });
  }

  applyPatchAndOpen = async () => {
    await this.handleApplyPatch();

    this.setState({
      showDiff: true
    }, () => {
      this.patchAceEditor.editor.resize();
    });
  }


  handleClickOutsideResourceInput = (e) => {
    const { addingNewResource } = this.state;
    if (addingNewResource && !this.addResourceWrapper.current.contains(e.target)) {
      this.setState({ addingNewResource: false, newResourceName: "" });
      window.removeEventListener("click", this.handleClickOutsideResourceInput);
    }
  }
  generateKustomization = async () => {
    const { API_ENDPOINT } = this.props;
    const { savedOverlays } = this.state;

    const resp = await fetch(`${API_ENDPOINT}/kustomize/kustomization`, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "resources": savedOverlays.map(o => o.path),
        "patches": savedOverlays.map(o => o.path)
      })
    });

    const json = await resp.json();
    debugger;
    let kustomizationYaml = savedOverlays.find(o => o.path === "kustomization.yaml");
    if (!kustomizationYaml) {
      kustomizationYaml = {
        name: "kustomization.yaml",
        path: "kustomization.yaml",
        content: "INSERT YAML HERE"
      };
    }

    const newOverlays = [
      ...savedOverlays,
      kustomizationYaml
    ];

    this.setState({
      savedOverlays: newOverlays
    });
  }

  savePatch = () => {
    const {
      selectedFile,
      savedOverlays,
      patch
    } = this.state;
    const file = this.getFile(selectedFile);
    const newOverlays = [
      ...savedOverlays,
      {
        path: selectedFile,
        name: file.name,
        content: file.content,
        patch,
      }
    ];
    console.log("saving Patch and setting state");
    this.setState({
      savedOverlays: newOverlays
    }, this.generateKustomization);

  }

  render() {
    const {
      files,
      finalized,
      patch,
      selectedFile,
      showDiff,
      modalAction
    } = this.state;

    const showOverlay = patch.length;
    return (
      <div className="flex flex1">
        <div className="u-minHeight--full u-minWidth--full flex-column flex1 u-position--relative">
          <div className="flex flex1 u-minHeight--full u-height--full">
            <div className="flex-column flex1 Sidebar-wrapper u-overflow--hidden">
              <div className="flex-column flex1">
                <div className="flex1 u-overflow--auto u-background--biscay">
                  <div className="flex1 dirtree-wrapper u-overflow--hidden flex-column">
                    <FileTree
                      files={files}
                      allowModification={true}
                      isRoot={true}
                      savedOverlays={this.state.savedOverlays}
                      handleFileSelect={(path) => this.setSelectedFile(path)}
                      handleDeleteOverlay={this.toggleModal}
                      handleClickExcludedBase={this.toggleModalForExcludedBase}
                      selectedFile={this.state.selectedFile}
                      restrictToYaml={true}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-column flex1">

              <div className="flex flex1">
                <div className="flex-column flex1">
                  <div className="u-paddingLeft--20 u-paddingRight--20 u-paddingTop--20">
                    <p className="u-marginBottom--normal u-fontSize--large u-color--tuna u-fontWeight--bold">Base YAML</p>
                    <p className="u-fontSize--small u-lineHeight--more u-paddingBottom--20 u-fontWeight--medium u-color--doveGray">This file will be applied as a patch to the base manifest. Edit the values that you want patched. The current file you're editing will be automatically saved when you open a new file.</p>
                  </div>
                  {this.state.selectedFileContent
                    ? (
                      <div className="flex1 file-contents-wrapper AceEditor--wrapper">
                        {!showOverlay &&
                          <div data-tip="create-overlay-tooltip" data-for="create-overlay-tooltip" className="overlay-toggle u-cursor--pointer" onClick={this.createOverlay}>
                            <span className="icon clickable u-overlayCreateIcon"></span>
                          </div>
                        }
                        { /* <ReactTooltip id="create-overlay-tooltip" effect="solid" className="replicated-tooltip">Create patch</ReactTooltip> */}
                        <AceEditorHOC
                          handleGeneratePatch={this.handleGeneratePatch}
                          handleApplyPatch={this.handleApplyPatch}
                          fileToView={{
                            baseContent: this.state.selectedFileContent,
                            isResource: false,
                            isSupported: true,
                            key: this.state.selectedFile
                          }}
                          diffOpen={this.state.showDiff}
                          overlayOpen={showOverlay}
                        />
                      </div>
                    ) : (

                      <div className="empty-file-wrapper flex flex1 justifyContent--center alignItems--center">
                        <p>No file selected. Drag and drop a file or folder onto the file tree to get started</p>
                      </div>
                    )}
                </div>
                <div className="flex-column flex1">
                  <div className="u-paddingLeft--20 u-paddingRight--20 u-paddingTop--20">
                    <p className="u-marginBottom--normal u-fontSize--large u-color--tuna u-fontWeight--bold">Patch</p>
                    <p className="u-fontSize--small u-lineHeight--more u-paddingBottom--20 u-fontWeight--medium u-color--doveGray">This file will be applied as a patch to the base manifest. Edit the values that you want patched.</p>
                  </div>
                  { patch
                      ? (
                          <div className="flex1 AceEditor--wrapper file-contents-wrapper u-position--relative">
                            <AceEditor
                              ref={ref => { this.patchAceEditor = ref ;} }
                              mode="yaml"
                              theme="chrome"
                              className="flex1 flex"
                              value={patch || ""}
                              height="100%"
                              width="100%"
                              editorProps={{
                                $blockScrolling: Infinity,
                                useSoftTabs: true,
                                tabSize: 2,
                              }}
                              onChange={this.handlePatchChange}

                              setOptions={{
                                scrollPastEnd: false
                              }}
                            />
                          </div>
                        )
                      : (
                        <div className="flex flex1 empty-file-wrapper alignItems--center justifyContent--center">
                          <p>Click on a line in the base YAML to generate a patch</p>
                        </div>
                      )
                  }
                </div>
              </div>

              { patch && selectedFile && finalized && (
                <div className="flex diff-viewer-wrapper alignItems--center justifyContent--center">
                  <p className="diff-toggle" onClick={this.toggleDiffViewer}>{showDiff ? "Hide" : "Show"} Diff</p>
                </div>
              )}
              { patch && selectedFile && finalized && showDiff && (
                <div className="flex diff-viewer-wrapper flex-column flex1">
                  <DiffEditor
                    diffTitle="Diff YAML"
                    diffSubCopy="Here you can see the diff of the base YAML, and the finalized version with the overlay applied."
                    original={this.state.strippedOriginal}
                    updated={this.state.finalized}
                  />
                </div>
              )}

              <div className="flex-auto flex layout-footer-actions less-padding">
                <div className="flex flex1">
                  {/*firstRoute ? null :
                    <div className="flex-auto u-marginRight--normal">
                      <button className="btn secondary" onClick={() => goBack()}>Back</button>
                    </div>
                  */}
                  <div className="flex-column flex-verticalCenter">
                    <p className="u-margin--none u-marginRight--30 u-fontSize--small u-color--dustyGray u-fontWeight--normal">Contributed by <a target="_blank" rel="noopener noreferrer" href="https://replicated.com" className="u-fontWeight--medium u-color--astral u-textDecoration--underlineOnHover">Replicated</a></p>
                  </div>
                </div>
                <div className="flex1 flex alignItems--center justifyContent--flexEnd">
                  {this.state.selectedFileContent && (
                    <div className="flex">
                      <button type="button" onClick={this.applyPatchAndOpen} className="btn primary u-marginRight--10">Apply Patch</button>
                      {patch !== "" && (
                        <button type="button" onClick={this.savePatch} className="btn primary">Save Patch</button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        <KustomizeModal
          isOpen={this.state.displayConfirmModal}
          onRequestClose={this.toggleModal}
          discardOverlay={modalAction}
          message={this.state.displayConfirmModalMessage}
          subMessage={this.state.displayConfirmModalSubMessage}
          discardMessage={this.state.displayConfirmModalDiscardMessage}
        />
      </div>
    );
  }
}
