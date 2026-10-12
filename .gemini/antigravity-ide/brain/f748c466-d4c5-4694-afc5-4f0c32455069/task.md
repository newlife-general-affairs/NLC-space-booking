# Refactoring Progress

- [x] Install Jest testing library in backend devDependencies
- [x] Implement core Lego Block framework
  - [x] `BaseBlock.js`
  - [x] `BlockPipeline.js`
  - [x] `BookingError.js`
- [x] Implement standalone Lego blocks
  - [x] `InputValidationBlock.js`
  - [x] `TimingPolicyBlock.js`
  - [x] `SuspensionCheckBlock.js`
  - [x] `OverlapCheckBlock.js`
  - [x] `DbInsertBlock.js`
  - [x] `EmailNotifyBlock.js`
- [x] Integrate pipeline into `backend/routes/bookings.js`
- [x] Write unit tests for each block and pipeline in `backend/tests/`
- [x] Run tests and verify the implementation
- [x] Verify existing booking logic runs successfully
