## Features
- Add support for preLoad variables - this will allow us to query the src org with a SOQL query and create dynamic variables.
- Add support for loaders.mappings.removeSrcField - currently we always remove the srcField in the mapping when transforming to the destField.
- Add support for loaders.postLoad variables - this will allow us to query the dest org with SOQL and create dynamic variables.

## Tech Debt
- Break out code pieces into separate classes/files
- Unit tests