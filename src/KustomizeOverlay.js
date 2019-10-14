import React, { Component } from "react";
// import classNames from "classnames";
// import keyBy from "lodash/keyBy";
import AceEditor from "react-ace";
import find from "lodash/find";
import findIndex from "lodash/findIndex";

import FileTree from "./FileTree";
import KustomizeModal from "./KustomizeModal";

// const PATCH_OVERLAY = "PATCH";
const BASE_OVERLAY = "BASE";
const RESOURCE_OVERLAY = "RESOURCE";

export default class BespokeKustomizeOverlay extends Component {
  constructor(props) {
    super(props);

    this.state = {
      files: [],
      addingNewResource: false,
      lastSavedPatch: null,
      patch: "",
      newResourceName: "",
      savingFinalize: false,
      selectedFile: "",
      selectedFileContent: null,
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

  setSelectedFile = async (path) => {
    const { lastSavedPatch, patch } = this.state;
    /* eslint-disable-next-line no-restricted-globals */
    let canChangeFile = !lastSavedPatch || patch === lastSavedPatch || confirm("You have unsaved changes in the patch. If you proceed, you will lose any of the changes you've made.");

    if (canChangeFile) {
      this.setState({ selectedFile: path, lastSavedPatch: null });
      const file = this.getFile(path);
      this.setState({
        selectedFileContent: file.content
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

  handleCreateNewResource = (e) => {
    const KEY_ENTER = 13;
    if (e.charCode === KEY_ENTER) {
      this.handleCreateResource()
    }
  }

  handleCreateResource = async () => {
    // const { newResourceName } = this.state;
    // const contents = "\n"; // Cannot be empty
    // this.setState({ patch: contents });

    // TODO:  Redux stuff here. Get rid and move to calling API
    // const payload = {
    //   path: `/${newResourceName}`,
    //   contents,
    //   isResource: true
    // };

    // await this.props.saveKustomizeOverlay(payload)
    //   .then(() => {
    //     this.setSelectedFile(`/${newResourceName}`);
    //     this.setState({ addingNewResource: false, newResourceName: "" })
    //   })
    //   .catch((err) => {
    //     this.setState({
    //       savePatchErr: true,
    //       savePatchErrorMessage: err.message
    //     });

    //     setTimeout(() => {
    //       this.setState({
    //         savePatchErr: false,
    //         savePatchErrorMessage: ""
    //       });
    //     }, 3000);
    //   });
    // await this.props.getCurrentStep();
  }

  handleAddResourceClick = async () => {
    // Ref input won't focus until state has been set
    this.setState({ addingNewResource: true }, () => {
      this.addResourceInput.current.focus();
    });

    window.addEventListener("click", this.handleClickOutsideResourceInput);
  }

  handleClickOutsideResourceInput = (e) => {
    const { addingNewResource } = this.state;
    if (addingNewResource && !this.addResourceWrapper.current.contains(e.target)) {
      this.setState({ addingNewResource: false, newResourceName: "" });
      window.removeEventListener("click", this.handleClickOutsideResourceInput);
    }
  }

  render() {
    const {
      files,
      dataLoading,
      patch,
      savingFinalize,
      addingNewResource,
      newResourceName,
      modalAction
    } = this.state;
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
                      handleFileSelect={(path) => this.setSelectedFile(path)}
                      handleDeleteOverlay={this.toggleModal}
                      handleClickExcludedBase={this.toggleModalForExcludedBase}
                      selectedFile={this.state.selectedFile}
                      // isOverlayTree={tree.name === "overlays"}
                      // isResourceTree={tree.name === "resources"}
                      // isBaseTree={tree.name === "/"}
                      restrictToYaml={true}
                    />

                    <div className="add-new-resource u-position--relative" ref={this.addResourceWrapper}>
                      <input
                        type="text"
                        className={`Input add-resource-name-input u-position--absolute ${!addingNewResource ? "u-visibility--hidden" : ""}`}
                        name="new-resource"
                        placeholder="filename.yaml"
                        onChange={(e) => { this.setState({ newResourceName: e.target.value }) }}
                        onKeyPress={(e) => { this.handleCreateNewResource(e) }}
                        value={newResourceName}
                        ref={this.addResourceInput}
                      />
                      <p
                        className={`add-resource-link u-position--absolute u-marginTop--small u-marginLeft--normal u-cursor--pointer u-fontSize--small u-color--silverSand u-fontWeight--bold ${addingNewResource ? "u-visibility--hidden" : ""}`}
                        onClick={this.handleAddResourceClick}
                      >+ Add Resource
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex-column flex1">
              <div className="u-paddingLeft--20 u-paddingRight--20 u-paddingTop--20">
                <p className="u-marginBottom--normal u-fontSize--large u-color--tuna u-fontWeight--bold">Base YAML</p>
                <p className="u-fontSize--small u-lineHeight--more u-paddingBottom--20 u-fontWeight--medium u-color--doveGray">This file will be applied as a patch to the base manifest. Edit the values that you want patched. The current file you're editing will be automatically saved when you open a new file.</p>
              </div>
              { this.state.selectedFileContent
                ? (
                <AceEditor
                  ref={this.setAceEditor}
                  mode="yaml"
                  className="flex1 flex acePatchEditor"
                  value={this.state.selectedFileContent}
                  height="100%"
                  width="100%"
                  editorProps={{
                    $blockScrolling: Infinity,
                    useSoftTabs: true,
                    tabSize: 2,
                  }}
                  debounceChangePeriod={1000}
                  setOptions={{
                    scrollPastEnd: false
                  }}
                // onChange={(patch) => this.updateModifiedPatch(patch, fileToView.isResource)}
                />
              ) : (
                <div className="flex flex1 zero-state justifyContent--center alignItems--center">
                    <p>No file selected. Drag and drop a file or folder onto the file tree to get started</p>
                  </div>
              )
            }
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
                  {this.state.selectedFileContent === "" ?
                    <button type="button" onClick={this.props.skipKustomize} className="btn primary">Continue</button>
                    :
                    <div className="flex">
                      { /*
                      {applyPatchErr && <span className="flex flex1 u-fontSize--small u-fontWeight--medium u-color--chestnut u-marginRight--20 alignItems--center">{applyPatchErrorMessage}</span>}
                      {savePatchErr && <span className="flex flex1 u-fontSize--small u-fontWeight--medium u-color--chestnut u-marginRight--20 alignItems--center">{savePatchErrorMessage}</span>}

                      */}

                      <button type="button" disabled={ /*dataLoading.saveKustomizeLoading || patch === "" || savingFinalize */ false} onClick={() => this.handleKustomizeSave(false)} className="btn primary save-btn u-marginRight--normal">{dataLoading.saveKustomizeLoading && !savingFinalize ? "Saving patch" : "Save patch"}</button>
                      {patch === "" ?
                        <button type="button" onClick={this.props.skipKustomize} className="btn primary">Continue</button>
                        :
                        <button type="button" disabled={/*dataLoading.saveKustomizeLoading || patch === "" || savingFinalize */ false} onClick={() => this.handleKustomizeSave(true)} className="btn secondary finalize-btn">{savingFinalize ? "Finalizing overlay" : "Save & continue"}</button>
                      }
                    </div>
                  }
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
