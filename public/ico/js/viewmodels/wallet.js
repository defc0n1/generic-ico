Number.prototype.formatNumber = function(p, d, c){
        var n = this,
        p = isNaN(p = Math.abs(p)) ? 2 : p,
        d = d === undefined ? "." : d,
        c = c === undefined ? "," : c,
        s = n < 0 ? "-" : "",
        i = parseInt(n = Math.abs(+n || 0).toFixed(p)) + "",
        j = (j = i.length) > 3 ? j % 3 : 0;
       return s + (j ? i.substr(0, j) + c : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + c) + (p ? d + Math.abs(n - i).toFixed(p).slice(2) : "");
};

define(['knockout',
    'common/dialog',
    'viewmodels/wallet-status',
    'viewmodels/home/home',
    'viewmodels/profile/profile',
    'viewmodels/faq/faq',
    'viewmodels/terms/terms',
    'bindinghandlers/modal',
    'viewmodels/common/wallet-passphrase',
    'viewmodels/common/command'], function(ko, dialog, WalletStatus, Home, Profile, FAQ, Terms, Modal, WalletPassphrase, Command, NodeStats){

    var walletType = function(){
        var self = this;

        self.walletUp = ko.observable(false);        // Is the wallet node available?

        self.sessionTimeout = ko.observable(2 * 60 * 60 * 1000); // Application session timeout = 2 Hours between change of views.
        self.sessionExpires = ko.observable(Date.now() + self.sessionTimeout());

        self.User = ko.observable({});
        self.role = ko.observable("");             // For features control

        self.node_id = ko.observable("");
        self.account = ko.observable("");
        self.addresses = ko.observableArray([]);

        self.settings = ko.observable({});          // Some settings from settings.json

        self.albumid = ko.observable("");           //for single album page

        // Get node_id and settings, and User account
        self.initNode('/ico'); // Initialize chRoot to common production environment.

        self.walletStatus = new WalletStatus({parent: self});

        self.currentView = ko.observable('home');
        self.sidebarToggled = ko.observable(false);
        self.showStats = ko.observable(true);

        this.home = new Home({parent: self});
        this.profile = new Profile({parent: self});
        this.faq = new FAQ({parent: self});
        this.terms = new Terms({parent: self});
        
        self.currentView.subscribe(function (view){
            self.sessionExpires(Date.now() + self.sessionTimeout());
            switch(view){
                case ("home"):
                    self.home.refresh(false);
                    break;
                case ("profile"):
                    self.profile.refresh(false);
                    break;
                case ("faq"):
                    self.faq.refresh(false);
                    break;
                case ("terms"):
                    self.terms.refresh(false);
                    break;
                default:
                    break;
            }
        });

        self.emailVerified = ko.computed(function(){
            var isVerified = false;
            if (self.User().profile && typeof self.User().profile.verified !== 'undefined') {
                isVerified = self.User().profile.verified === "Y" &&
                             self.User().profile.email && self.User().profile.email !== "";
            }
            return isVerified;
        });

        self.profileComplete = ko.computed(function(){
            var isComplete = false;
            if (self.User().profile && typeof self.User().profile.terms !== 'undefined') {
                isComplete = self.User().profile.first_name && self.User().profile.first_name !== "" &&
                             self.User().profile.last_name && self.User().profile.last_name !== "" &&
                             self.User().profile.email && self.User().profile.email !== "" &&
                             self.User().profile.terms && self.User().profile.terms === true;
            }
            return isComplete;
        });

        self.initComplete = false;
        self.isLoadingStatus = ko.observable(true);

        self.timeout = 1000;

        // Start polling!
        self.pollWalletStatus();
    };

    // Called once at startup.
    walletType.prototype.initNode = function(chRoot) {
        var self = this;
        // Catch-22: We don't know if Generic-ICO is chRoot'd to /public or /public/ico,
        // because 'settings' has not been set yet, so we need to test for a failure first
        // to determine if settings().chRoot is "" or "/ico".
        var getNodeInfoCommand = new Command('getnodeinfo', [],
                                             chRoot, // unknown chRoot on first call.
                                             'production'); // Gets the wallet info and settings quietly
        $.when(getNodeInfoCommand.execute())
            .done(function(getNodeInfoData) {
                if (typeof getNodeInfoData.settings.wallet.rpchost !== 'undefined'){
                    self.node_id(getNodeInfoData.settings.wallet.rpchost);
                    self.settings(getNodeInfoData.settings);
                    self.showStats(self.settings().showStats || false);
                    if (self.settings().env !== 'production'){
                        console.log("WARNING: Not running in production mode!\n  (settings.env=" + self.settings().env + ")");
                    }
                } else {
                    // Bailing...
                    console.log("ERROR: Aborting! Node_ID not found.");
                    window.location = chRoot + '/logout';
                }
                //console.log("DEBUG: node_id: " + self.node_id());
                self.initUser();
            }).fail(function(jqXHR){
                // If the second call to initNode fails, we bail.
                if (chRoot !== '') {
                    self.initNode(''); // Set unknown chRoot to normal '' mode.
                } else {
                    // Bailing...
                    console.log("ERROR: Aborting! Unknown chRoot!");
                    console.log("jqXHR: " + JSON.stringify(jqXHR));
                    window.location = chRoot + '/logout';
                }
            });
    };

    // Called once at startup.
    walletType.prototype.initUser = function(){
        var self = this;
        var getUserAccountCommand = new Command('getuseraccount', [],
                                                self.settings().chRoot,
                                                self.settings().env);
        $.when(getUserAccountCommand.execute())
            .done(function(getUserAccountData){
                if (typeof getUserAccountData.User !== 'undefined'){
                    self.User(getUserAccountData.User);
                    self.role(self.User().profile.role);
                    // Get the user's wallet account info for this node_id
                    var wallet = self.User().wallet.filter(function(wal){
                        if (wal.node_id && wal.node_id === self.node_id()){
                            wal.addresses.sort(function(a, b){return b.amount - a.amount;}); // Sort by amount descending
                            self.account(wal.account);
                            self.addresses(wal.addresses);
                            return wal;
                        }
                    });
                    if (!wallet) {
                        // Bailing...
                        console.log("ERROR: Aborting! User wallet not found.");
                        window.location = self.settings().chRoot + '/logout';
                    } else {
                        wallet = null;
                    }
                } else {
                    // Bailing...
                    console.log("ERROR: Aborting! User account not found.");
                    window.location = self.settings().chRoot + '/logout';
                }
                // Set flag for pollWalletStatus
                self.initComplete = true;
                // Turn off initial loading icon
                self.isLoadingStatus(false);
            });
    };

    // Refresh the universe every 'self.timeout' miliseconds.
    walletType.prototype.pollWalletStatus = function(){
        var self = this;
        setTimeout(function(){
            // If initialization is complete and the wallet daemon is available.
            if (!self.initComplete){
                // Prevent polling forever if init never finishes.
                if (Date.now() <= self.sessionExpires()){
                        self.pollWalletStatus();
                } else {
                    console.log("Session Expired. Polling stopped.");
                    window.location = self.settings().chRoot + '/logout';
                }
            } else {
                // Normal polling
                if (Date.now() <= self.sessionExpires()){
                    $.when(self.refresh(true)).done(function(){
                        if (self.timeout < 60000){ // First timeout
                            self.timeout = 60000;
                            // NOTE: self.walletUp() is set true when the socket server sends the message.
                            // (see /public/../js/app.js).
                            if (self.walletUp()) {
                                // One-time call after first refresh
                                self.checkEncryptionStatus();
                            }
                        }
                        // This gets re-called until the user completes their profile.
                        // TODO: Find a better way to do this!
                        if (!self.profileComplete()){
                            self.initUser();
                        }
                        self.pollWalletStatus();
                    });
                } else {
                    console.log("Session Expired. Polling stopped.");
                    window.location = self.settings().chRoot + '/logout';
                }
            }
        },self.timeout);
    };

    // Refresh the universe. If timerRefresh is false it's a manual refresh.
    walletType.prototype.refresh = function(timerRefresh){
        var self = this;
        var refreshPromise = $.when(self.walletStatus.refresh())
            .done(function(){
                self.home.refresh(timerRefresh);
                self.profile.refresh(timerRefresh);
                self.faq.refresh(timerRefresh);
                self.terms.refresh(timerRefresh);
            });
        return refreshPromise;
    };

    walletType.prototype.checkEncryptionStatus = function(){
        var self = this;
        // Do not allow non-local wallets to be encrypted except by MASTER_ACCOUNT!
        if (self.account() === self.settings().masterAccount && self.settings().masterCanEncrypt === true){
            switch(self.walletStatus.unlockedUntil()){
            case -1: // wallet is unencrypted
                self.promptToEncrypt();
                break;
            case 0:  // wallet is locked
                self.promptToUnlockForStaking();
                break;
            default: // 999999 - wallet is already unlocked for staking
                break;
            }
        }
    };

    walletType.prototype.unlockWallet = function(){
        var self = this;
        if (self.account() === self.settings().masterAccount){
            new WalletPassphrase({canSpecifyStaking: true}).userPrompt(false, 'Unlock Wallet', 'This action will unlock the wallet for sending or staking','OK')
            .done(function(result){
                //console.log(result);
                self.walletStatus.refresh();
                result.passphrase = "XXXXXXXX"; // Clear password in memory
            })
            .fail(function(error){
                if (error) {
                    console.log(error);
                    dialog.notification(error.message);
                    self.walletStatus.refresh();
                }
            });
        }
    };

    walletType.prototype.lockWallet = function(){
        var self = this;
        if (self.account() === self.settings().masterAccount){
            var walletLockCommand = new Command('walletlock', [],
                                                self.settings().chRoot,
                                                self.settings().env).execute()
            .done(function(){
                dialog.notification("Wallet is now locked. To send transactions or stake you must unlock the wallet.");
                self.walletStatus.refresh();
            })
            .fail(function(){
                dialog.notification("Wallet is already locked.");
                self.walletStatus.refresh();
            });
            return walletLockCommand;
        }
    };

    walletType.prototype.promptToEncrypt = function(){
        new WalletPassphrase().userPrompt(true, 'Encrypt Wallet', 'Encrypt','OK')
            .done(function(result){
                console.log(result);
                dialog.notification("Wallet successfully encrypted. Restart your coin daemon to continue.");
            })
            .fail(function(error){
                if (error) {
                    console.log(error);
                    dialog.notification(error.message);
                }
            });
    };

    walletType.prototype.promptToUnlockForStaking = function(){
        new WalletPassphrase({canSpecifyStaking: true}).userPrompt(false, 'Unlock Wallet', 'Unlock the wallet','OK')
            .done(function(result){
                result.passphrase = "XXXXXXXX"; // Clear password in memory
                console.log(result);
            })
            .fail(function(error){
                if (error) {
                    console.log(error);
                    dialog.notification(error.message);
                }
            });
    };

    walletType.prototype.formatNumber = function(value, decimalPlaces, decimalPoint, commaSeparator){
        return value.formatNumber(decimalPlaces, decimalPoint, commaSeparator);
    };

    walletType.prototype.toggleSidebar = function(){
        this.sidebarToggled(!this.sidebarToggled());
    };

    return walletType; 
});
