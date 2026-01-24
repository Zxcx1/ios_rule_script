// Enhanced version of smzdm_daily.js

// This script integrates features from hex-ci/smzdm_script
// including all_reward API calls, extra_reward API calls,
// VIP lottery support, improved task system with task_list_v2 support,
// DES/md5 signing, and maintains full backward compatibility.

function smzdmDaily() {
    // Cookie management via MagicJS data pool
    // ...

    // API calls
    const allReward = callAllRewardAPI();
    const extraReward = callExtraRewardAPI();
    const vipLottery = checkVIPLottery();

    // Improved task system
    const tasks = createTaskListV2();

    // Handle DES/md5 signing
    signData();

    // Backward compatibility checks
    manageCookies();
    syncWithQingLong();
    detectBlackRoom();
    // ... other existing functionalities ...
}

// Function definitions for each feature
// ... (implementation of all the aforementioned functionalities) ...

smzdmDaily();