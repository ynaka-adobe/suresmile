# Adobe AppMeasurement

Unmodified official Adobe AppMeasurement **2.27.0**, Apache-2.0 licensed.
The copyright notice and upstream license are retained.

- Release: https://github.com/adobe/appmeasurement/releases/tag/v2.27.0
- Commit: `26fc9c8284ced0d17728be23efca322332043aca`
- Source: https://raw.githubusercontent.com/adobe/appmeasurement/v2.27.0/dist/AppMeasurement.js
- SHA-256: `7e85fa23d5aa05547cd7f61bb755be05d10b34f5589b06a726f62f7d539c2a3d`

The consent-gated adapter loads this local distribution only after approval.
It disables bundled ActivityMap link/region capture, automatic exit/download
tracking and offline queuing. VisitorAPI, AudienceManagement and Integrate are
not installed. Do not add a vendor bootstrap that sends an automatic page view.
