import * as React from "react";
import classNames from "classnames";
import find from "lodash/find";

// import Tooltip from "./Tooltip";

function rootPath(path) {
  if (path[0] !== "/") {
    return path = "/" + path;
  } else {
    return path;
  }
}

export default class FileTree extends React.Component {
  constructor() {
    super();

    this.state = {
      selected: {},
      draggedFile: null,
    };

    this.filesRefs = {};
  }

  preventDefault = e => {
    /* eslint-disable-next-line */
    e = e || event;
    e.preventDefault();
  }

  componentDidMount() {
    if (this.props.allowModification) {
      window.addEventListener("dragover", this.preventDefault, false);
      window.addEventListener("drop", this.preventDefault, false);
    }
  }

  componentWillUnmount() {
    if (this.props.allowModification) {
      window.removeEventListener("dragover", this.preventDefault, false);
      window.removeEventListener("drop", this.preventDefault, false);
    }
  }

  displayTooltip = (key, value) => {
    return () => {
      this.setState({
        [`${key}Hovered`]: value,
      });
    };
  }

  getRootFiles = () => {
    return this.props.rootFiles || this.props.files;
  }

  handleFileSelect = (file) => {
    const onlyPath = typeof this.props.selectedFile === "string";
    this.props.handleFileSelect(onlyPath ? file.path : file, file);
  }

  handleFilesUpdate = (files) => {
    if (this.props.handleFilesUpdate) {
      this.props.handleFilesUpdate(files);
    }
  }

  handleCheckboxChange(filePath, isChecked) {
    this.setState({
      selected: Object.assign({}, this.state.selected, {
        [filePath]: isChecked
      })
    })
  }

  getLevel() {
    return this.props.level || 0
  }

  arePathsSame(path1, path2) {
    const newPath1 = rootPath(path1);
    const newPath2 = rootPath(path2);
    return newPath1.split(/\//).slice(1, 2 + this.getLevel()).join("/") === newPath2.split(/\//).slice(1, 2 + this.getLevel()).join("/")
  }

  isFileAllowed = name => {
    return !this.props.restrictToYaml || this.isFileYaml(name);
  }

  isFileYaml = name => {
    if (name.length < 5) {
      return false;
    }
    return name.toLowerCase().substr(name.length - 4) === ".yml" || name.toLowerCase().substr(name.length - 5) === ".yaml";
  }

  getFileInTree = (files, path) => {
    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      if (file.children.length > 0) {
        return this.getFileInTree(file.children, path);
      } else if (file.path === path) {
        return file;
      }
    }
    return null;
  }

  readFileContent = item => {
    return new Promise(resolve => {
      item.file(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target.result;
          resolve(content);
        };
        reader.readAsText(file);
      });
    });
  }

  moveSingleFileToDir = async (item, dir) => {
    const rootFiles = this.getRootFiles();
    const content = await this.readFileContent(item);
    const path = !dir ? item.name : `${dir.path + "/" + item.name}`;
    const newFile = { name: item.name, path: path, content: content, children: [] };
    if (!dir) {
      this.removeFileFromTree(rootFiles, newFile); // remove if exists
      rootFiles.push(newFile);
    } else {
      this.removeFileFromTree(dir.children, newFile); // remove if exists
      dir.children.push(newFile);
    }
    this.handleFileSelect(newFile);
    this.handleFilesUpdate(rootFiles);
  }

  moveSingleDirToDir = (srcDir, destDir) => {
    const rootFiles = this.getRootFiles();
    if (!destDir) {
      this.removeFileFromTree(rootFiles, srcDir); // remove if exists
      rootFiles.push(srcDir);
    } else {
      this.removeFileFromTree(destDir.children, srcDir); // remove if exists
      destDir.children.push(srcDir);
    }
    this.handleCheckboxChange(srcDir.path, true);
    if (this.props.selectedFile) {
      const file = this.getFileInTree(srcDir.children, this.props.selectedFile && this.props.selectedFile.path);
      if (file) {
        this.handleFileSelect(file);
      }
    }
    this.handleFilesUpdate(rootFiles);
  }

  generateDirFileTree = (dir, basePath) => {
    const dirFileTreePath = basePath ? (basePath + "/" + dir.name) : dir.name;
    const dirFileTree = { name: dir.name, path: dirFileTreePath, content: "", children: [] };
    return new Promise(resolve => {
      const dirReader = dir.createReader();
      dirReader.readEntries(async items => {
        for (let item of items) {
          if (item.name.startsWith(".")) {
            continue;
          }
          if (item.isDirectory) {
            const subDir = await this.generateDirFileTree(item, dirFileTree.path);
            if (subDir.children.length > 0) {
              dirFileTree.children.push(subDir);
            }
          } else if (this.isFileAllowed(item.name)) {
            const content = await this.readFileContent(item);
            const path = dirFileTree.path + "/" + item.name;
            const newFile = { name: item.name, path: path, content: content, children: [] };
            dirFileTree.children.push(newFile);
          }
        }
        resolve(dirFileTree);
      });
    });
  }

  moveToDir = async (e, dir) => {
    const rootFiles = this.getRootFiles();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) { // Adding files from disk
      const items = e.dataTransfer.items;
      for (let i = 0; i < items.length; i++) {
        // NOTE: webkitGetAsEntry() is an experimental tech
        // and may be deprecated in future browser releases
        const item = items[i].webkitGetAsEntry();

        // webkitGetAsEntry did not detect a file.
        if (item === null) {
          continue;
        }

        if (item.name.startsWith(".")) {
          continue;
        }
        if (item.isDirectory) {
          const basePath = dir ? dir.path : null;
          this.generateDirFileTree(item, basePath).then(itemDirFileTree => {
            if (itemDirFileTree.children.length > 0) {
              this.moveSingleDirToDir(itemDirFileTree, dir);
            }
          });
        } else if (this.isFileAllowed(item.name)) {
          this.moveSingleFileToDir(item, dir);
        }
      }
    } else { // Rearranging files
      const file = this.props.draggedFile || this.state.draggedFile;
      this.removeFileFromTree(rootFiles, file);
      file.path = !dir ? file.name : `${dir.path + "/" + file.name}`;
      if (!dir) {
        this.removeFileFromTree(rootFiles, file); // remove if exists
        rootFiles.push(file);
      } else {
        this.removeFileFromTree(dir.children, file); // remove if exists
        dir.children.push(file);
      }
      this.handleFilesUpdate(rootFiles);
      this.handleFileSelect(file);
    }
  }

  removeFileFromTree = (files, fileToRemove) => {
    for (let f = 0; f < files.length; f++) {
      const file = files[f];
      if (file.path === fileToRemove.path) {
        files.splice(f, 1);
        f--;
      } else if (file.children.length > 0) {
        this.removeFileFromTree(file.children, fileToRemove);
        if (file.children.length === 0) {
          files.splice(f, 1);
          f--;
        }
      }
    }
  }

  removeFile = (e, file) => {
    this.stopEventPropagation(e);
    const rootFiles = this.getRootFiles();
    this.removeFileFromTree(rootFiles, file);
    this.handleFilesUpdate(rootFiles);
    const selectedFile = this.props.selectedFile;
    if (file.path === (selectedFile && selectedFile.path)) {
      if (this.props.files.length) {
        this.handleFileSelect(this.props.files[0]);
      } else if (rootFiles.length) {
        this.handleFileSelect(rootFiles[0]);
      }
    }
  }

  addNewFile = (isFolder) => {
    const rootFiles = this.getRootFiles();
    const name = isFolder ? "Folder" : "Untitled.yaml";
    const newFile = {
      name,
      path: name,
      content: "",
      children: [],
      isFolder,
    };
    this.removeFileFromTree(rootFiles, newFile); // remove if exists
    rootFiles.push(newFile);
    this.handleFilesUpdate(rootFiles);
    setTimeout(() => {
      this.editFileName(newFile);
    }, 100);
  }

  editFileName = (file) => {
    // enable content editable attribute for file
    const filesRefs = this.props.filesRefs || this.filesRefs;
    const el = filesRefs[file.path];
    el.setAttribute("contenteditable", true);
    el.focus();

    // highlight file name
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(el.childNodes[0], 0);
    if (file.isFolder) {
      range.setEnd(el.childNodes[0], el.childNodes[0].length);
    } else {
      range.setEnd(el.childNodes[0], el.childNodes[0].length - 5);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }

  onFileNameChange = (e, file) => {
    file.tempName = e.target.innerText;
  }

  finishEditingFileName = (file) => {
    // disable content editable attribute for file
    const filesRefs = this.props.filesRefs || this.filesRefs;
    const el = filesRefs[file.path];
    el.setAttribute("contenteditable", false);

    // assign final name and path & delete temp name
    if (file.tempName) {
      if (!file.isFolder && !this.isFileAllowed(file.tempName)) {
        file.tempName += ".yaml";
      }
      file.path = file.path.replace(file.name, file.tempName);
      file.name = file.tempName;
      delete file.tempName;
    }

    const nameContainsSlashes = file.name.includes("/");
    if (file.isFolder && !nameContainsSlashes) {
      // add new file to the empty folder
      file.name += "/Untitled.yaml";
      file.path = file.name;
    }

    const rootFiles = this.getRootFiles();

    if (file.name.includes("/")) {
      // create folders if name has slashes -> "/"
      this.removeFileFromTree(rootFiles, file);
      const fileTree = this.createSingleFileTree(file);

      // expand folder in filetree view
      this.handleCheckboxChange(fileTree.path, true);

      rootFiles.push(fileTree);
    }

    if (file.isFolder && !nameContainsSlashes) {
      // folder is created, now edit the name of the added new file inside it
      setTimeout(() => {
        this.editFileName(file);
      }, 200);
    }

    delete file.isFolder;
    this.handleFileSelect(file);
    this.handleFilesUpdate(rootFiles);
  }

  createSingleFileTree = (file) => {
    const parts = file.name.split("/");
    const folder = {
      name: parts[0],
      path: parts[0],
      content: "",
      children: [],
    };
    let currentLevel = folder.children;
    let currentPath = folder.path;
    for (let p = 1; p < parts.length; p++) {
      const part = parts[p];
      currentPath += "/" + part;
      if (p === parts.length - 1) {
        file.path = file.name;
        file.name = parts[parts.length - 1];
        currentLevel.push(file);
      } else {
        currentLevel.push({
          name: part,
          path: currentPath,
          content: "",
          children: [],
        });
        currentLevel = currentLevel[0].children;
      }
    }
    return folder;
  }

  removeFileFocusOnEnterKey = (e) => {
    if (e.key === 'Enter') {
      const el = document.querySelector(':focus');
      if (el) el.blur();
    }
  }

  setDraggedFile = file => {
    this.setState({ draggedFile: file });
  }

  stopEventPropagation = e => {
    e.preventDefault();
    e.stopPropagation();
  }

  onDragStart = (e, file) => {
    if (!this.props.allowModification) {
      return;
    }
    e.dataTransfer.clearData();
    if (this.props.setDraggedFile) {
      this.props.setDraggedFile(file);
    } else {
      this.setDraggedFile(file);
    }
  }

  onDragEnter = e => {
    if (!this.props.allowModification) {
      return;
    }
    this.stopEventPropagation(e);
    e.target.style.backgroundColor = "rgba(0, 0, 0, 0.2)";
  }

  onDragLeave = e => {
    if (!this.props.allowModification) {
      return;
    }
    this.stopEventPropagation(e);
    e.target.removeAttribute("style");
  }

  onDrop = (e, dir) => {
    if (!this.props.allowModification) {
      return;
    }
    this.stopEventPropagation(e);
    e.target.removeAttribute("style");
    this.moveToDir(e, dir);
    if (this.props.onDrop) {
      this.props.onDrop();
    }
  }

  getFileErrorType = file => {
    const expressions = this.props.lintExpressions;
    if (expressions) {
      const expression = find(expressions, ["path", file.path]);
      if (expression && (expression.type === "error" || expression.type === "warn")) {
        return expression.type;
      }
    }
    return null;
  }

  render() {
    const { files, selectedFile, handleFileSelect, allowModification, restrictToYaml, handleFilesUpdate, isRoot } = this.props;
    const selectedFilePath = typeof selectedFile === "string" ? selectedFile : (selectedFile && selectedFile.path) || "";
    const filesRefs = this.props.filesRefs || this.filesRefs;

    return (
      <ul
        className={`${isRoot ? "FileTree-wrapper u-minHeight--full u-position--relative" : "u-marginLeft--normal"}`}
        onDrop={this.onDrop}
        onDragEnter={this.onDragEnter}
        onDragLeave={this.onDragLeave}
      >
        { isRoot && <div className="overlay-list-title">Base</div>}
        {files && files.map((file, i) => {
          const fileErrorType = this.getFileErrorType(file);

          let selected = selectedFilePath === file.path;
          if (file.path === "kustomization.yaml" && this.props.selectedFileContent) {
            selected = !this.props.selectedFileContent.includes("bases:") && this.props.selectedFileContent.includes("kind: Kustomization");
          }

          return (
            file.children && file.children.length ?
              <li
                key={`${file.path}-Directory-${i}`}
                className="u-position--relative"
                onDrop={(e) => this.onDrop(e, file)}
                onDragEnter={this.onDragEnter}
                onDragLeave={this.onDragLeave}
              >
                <input
                  type="checkbox"
                  data-is-folder
                  checked={this.state.selected.hasOwnProperty(file.path) ? this.state.selected[file.path] : this.arePathsSame(selectedFilePath, file.path)}
                  onChange={e => this.handleCheckboxChange(file.path, e.target.checked)}
                  name={`sub-dir-${file.name}-${file.children.length}-${file.path}-${i}`}
                  id={`sub-dir-${file.name}-${file.children.length}-${file.path}-${i}`}
                />

                <label htmlFor={`sub-dir-${file.name}-${file.children.length}-${file.path}-${i}`}>{file.name}</label>

                <FileTree
                  level={this.getLevel() + 1}
                  files={file.children}
                  handleFileSelect={handleFileSelect}
                  selectedFile={selectedFile}
                  allowModification={allowModification}
                  restrictToYaml={restrictToYaml}
                  handleFilesUpdate={handleFilesUpdate}
                  setDraggedFile={this.props.setDraggedFile || this.setDraggedFile}
                  draggedFile={this.props.draggedFile || this.state.draggedFile}
                  rootFiles={this.props.rootFiles || files}
                  filesRefs={filesRefs}
                />
              </li>
              :
              <li
                key={file.path}
                className={`u-position--relative is-file ${selected ? "is-selected" : ""}`}
                draggable={allowModification}
                onClick={() => this.handleFileSelect(file)}
                onDragStart={(e) => this.onDragStart(e, file)}
                onDragEnter={this.stopEventPropagation}
                onDragLeave={this.stopEventPropagation}
              >
                {fileErrorType && <span className={`icon ${fileErrorType === "error" ? "LintError u-errorCircleIcon-small" : "LintWarn u-warningYellowIcon-small"}`} />}
                <span
                  ref={el => (filesRefs[file.path] = el)}
                  className="FileName"
                  onInput={(e) => this.onFileNameChange(e, file)}
                  suppressContentEditableWarning={true}
                  spellCheck={false}
                  onKeyPress={this.removeFileFocusOnEnterKey}
                  onBlur={() => this.finishEditingFileName(file)}
                >
                  {file.name}
                </span>
                {allowModification && <span className="RemoveFileIcon icon clickable u-whiteTrashIcon" onClick={e => this.removeFile(e, file)} />}
              </li>
          );
        })
        }

        {isRoot && this.props.savedOverlays && this.props.savedOverlays.length > 0 &&
          (
            <div className="overlay-list-wrapper">
              <div className="overlay-list-title">Overlay</div>
              {this.props.savedOverlays.map(overlay => {
                let selected = overlay.path === this.props.selectedFile;

                if (selected && this.props.selectedFile === "kustomization.yaml") {
                  selected = this.props.selectedFileContent.includes("kind: Kustomization") && this.props.selectedFileContent.includes("patchesStrategicMerge:");
                }
                return (
                  <div
                    key={overlay.path}
                    className={classNames("overlay-item u-postion--relative", {
                      selected
                    })}
                    onClick={() => {
                      this.props.handleFileSelect(overlay.path, overlay);
                    }}
                  >
                    {overlay.name}
                    {overlay.name !== "kustomization.yaml" && (
                      <span
                        className="u-position--absolute icon clickable icon-x"
                        onClick={() => this.props.onOverlayDelete(overlay.path)}
                      >

                      </span>
                    )}

                  </div>
                )
              })}
            </div>

          )
        }
        {isRoot && allowModification && files.length < 1 &&
          <div className="AddFilesWatermark-Wrapper">
            <span className="AddFilesWatermark-Text">Drag here<br />to add files</span>
          </div>
        }
      </ul>
    );
  }
}


