# CruzHacks 2024 Backend

This repository contains the Firestore rules, Firestore indexes, and Firebase
cloud functions used in CruzHacks 2024 sites. The mentality for this years
hackathon sites was to eliminiate the need for a full api layer by instead
using firebase's Javascript library to retrieve assets.

The existing backend functions use Express with custom middleware to validate
Firebase authenticated Id tokens. Additionally, to secure the backend Firestore
rules were used in combination with Firebase Custom Claims to specify user
roles (e.g. "hacker", "admin", etc.).

Therefore, the code here mostly contains triggers to maintain Custom Claim
roles, as well as special operations that are too combersome or complex for
purely frontend code.

## How to Run

1. Clone this repository
2. Install [firebase-tools](https://www.npmjs.com/package/firebase-tools) to
   emulate backend and run deploys
3. Navigate to the root of the repository and run `yarn` to install all
   the dependencies
4. Run `yarn start` to start the firebase emulators

## Available Scripts

- `yarn lint` -> lints code
- `yarn build` -> transpiles typescript into lib folder
- `yarn start` -> transpiles typescript and runs firebase emulators
- `yarn shell` -> transpiles typescript and runs interactive shell to test
  functions
- `yarn deploy` -> deploys firebase functions to firebase
- `yarn logs` -> print log to stdout
