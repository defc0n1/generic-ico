define(['knockout',
    'viewmodels/common/command',
    'common/dialog',
    'viewmodels/common/terms-dialog',
    'viewmodels/common/profile-pulldown',
    'moment'], function(ko, Command, Dialog, TermsDialog, ProfilePulldown, Moment){
    var profileType = function(options){
        var self = this;
        self.wallet = options.parent || {};
        self.ready = ko.observable(false);
        
        self.statusMessage = ko.observable("");

        // Source value arrays for pulldown menues
        self.profilePulldown = new ProfilePulldown();

        self.node_id = ko.observable("");
        self.account = ko.observable("");

        self.profileComplete = ko.observable(false);
        self.role = ko.observable("");
        self.login_type = ko.observable("");
        self.login_id = ko.observable("");
        self.credit = ko.observable(0.0000);
        self.creditFmt = ko.pureComputed(function(){return self.wallet.formatNumber(self.credit(), 4, '.', ',');});
        self.facebookUrl = ko.observable("https://facebook.com/");
        self.googleUrl = ko.observable("https://plus.google.com/");
        self.twitterUrl = ko.observable("https://twitter.com/");

        // User changeables
        self.first_name = ko.observable("");
        self.last_name = ko.observable("");
        self.email = ko.observable("");
        self.ethaddress = ko.observable("0x");
        self.btcaddress = ko.observable("0");
        self.age = ko.observable("");
        self.dob = ko.observable(Moment(Date.now()).utc().format("YYYY-MM-DD"));
        self.country = ko.observable("");
        self.terms = ko.observable(false);
        self.termsHTML = ko.observable("");

        // User changeables subscriptions
        self.first_name.subscribe(function (){self.dirtyFlag(true);});
        self.last_name.subscribe(function (){self.dirtyFlag(true);});
        self.email.subscribe(function (){self.dirtyFlag(true);});
        self.ethaddress.subscribe(function (){self.dirtyFlag(true);});
        self.btcaddress.subscribe(function (){self.dirtyFlag(true);});
        self.dob.subscribe(function (){
            var now = Moment().utc();
            var dob = Moment(self.dob()).utc();
            var curDateYY = now.format("YYYY");
            var curDateMM = now.format("MM");
            var curDateDD = now.format("DD");
            var dobDateYY = dob.format("YYYY");
            var dobDateMM = dob.format("MM");
            var dobDateDD = dob.format("DD");
            var age = curDateYY - dobDateYY;
            if (curDateMM < dobDateMM){
                age--;
            } else {
                if (curDateMM === dobDateMM && curDateDD < dobDateDD){
                    age--; // Almost birthday time!
                }
            }
            self.age(age);
            self.dirtyFlag(true);
        });
        self.country.subscribe(function (){self.dirtyFlag(true);});
        self.terms.subscribe(function (){
            if (self.ready()) {
                self.agreeToTerms();
                self.dirtyFlag(true);
            }
        });

        self.canSubmit = ko.computed(function(){
            var canSubmit = self.first_name() !== "" &&
                            self.last_name() !== "" &&
                            self.email() !== "";
            // Bottom to top messages
            if (!self.terms()){
                canSubmit = false;
                self.statusMessage("Please agree to the Terms & Conditions to continue.");
            }
            if (self.btcaddress().length !== 34 && self.btcaddress() !== "0"){
                canSubmit = false;
                self.statusMessage("Please enter your bitcoin address, or '0' if not sending BTC.");
            }
            if (self.ethaddress().length !== 42 && self.ethaddress().substring(0, 2) !== "0x"){
                canSubmit = false;
                self.statusMessage("Please enter a valid ethereum address. (e.g. 0xa538a...)");
            }
            //if (self.age() < 18){
            //    canSubmit = false;
            //    self.statusMessage("You must be 18 years-old or older.");
            //}
            if (canSubmit){
                self.statusMessage("");
            }
            return canSubmit;
        });

        self.dirtyFlag = ko.observable(false);
        self.isDirty = ko.computed(function() {
            return self.dirtyFlag();
        });
    };

    profileType.prototype.refresh = function(timerRefresh){
        var self = this;
        if (timerRefresh && !self.isDirty()){
            self.login_type(self.wallet.User().profile.login_type);
            switch(self.login_type()){
                case ("local"):
                    self.login_id(self.wallet.User().local.id);
                    break;
                case ("facebook"):
                    self.login_id(self.wallet.User().facebook.id);
                    break;
                case ("google"):
                    self.login_id(self.wallet.User().google.id);
                    break;
                case ("twitter"):
                    self.login_id(self.wallet.User().twitter.id);
                    break;
                default:
                    break;
            }
            self.role(self.wallet.User().profile.role || "User");
            self.node_id(self.wallet.node_id());
            self.account(self.wallet.account());

            self.first_name(self.wallet.User().profile.first_name || "");
            self.last_name(self.wallet.User().profile.last_name || "");
            self.email(self.wallet.User().profile.email || "");
            self.ethaddress(self.wallet.User().profile.ethaddress || "0x");
            self.btcaddress(self.wallet.User().profile.btcaddress || "0");
            self.age(self.wallet.User().profile.age || 0);
            if (self.wallet.User().profile.dob && self.wallet.User().profile.dob !== ""){
                self.dob(Moment(self.wallet.User().profile.dob).utc().format("YYYY-MM-DD"));
            } else {
                self.dob(Moment(Date.now()).utc().format("YYYY-MM-DD"));
            }
            self.country(self.wallet.User().profile.country || "");
            self.terms(self.wallet.User().profile.terms || false);
            self.credit(self.wallet.User().profile.credit || 0);

            // This has to be inside the !isDirty check
            if (!self.wallet.profileComplete()) {
                self.profileComplete(false);
            } else {
                self.profileComplete(true);
            }
            self.dirtyFlag(false);
            self.ready(true);
        }
        if (!timerRefresh && !self.isDirty()) {
            self.statusMessage("");
        }
    };

    profileType.prototype.userPrompt = function(koterms, title, affirmativeButtonText, negativeButtonText, message){
        var self = this,
            currentTerms = koterms();
            termsDeferred = $.Deferred(),
            termsDialog = new TermsDialog({
                title: title || '',
                contentTemplate: "modals/terms-message",
                context: self,
                canAffirm: function(){return true;},
                allowClose: false,
                showNegativeButton: true,
                message: message,
                affirmativeButtonText: affirmativeButtonText,
                negativeButtonText: negativeButtonText,
                affirmativeHandler: function(){
                    if (!currentTerms) {
                        self.ready(false); // Don't re-trigger
                        koterms(true);
                        self.ready(true);
                    }
                },
                negativeHandler: function(){
                    if (currentTerms) {
                        self.ready(false); // Don't re-trigger
                        koterms(false);
                        self.ready(true);
                    }
                }
            });
            termsDialog.open();

        return termsDeferred.promise();
    };

    profileType.prototype.agreeToTerms = function() {
        var self = this;
        if (self.terms()) {
            // Read file containing terms and conditions
            $.get("/docs/terms.txt", function(data) {
                self.termsHTML(data);
                }).done(function(){
                    self.userPrompt(self.terms, 'Terms and Conditions', 'Agree', 'Disagree', self.termsHTML());
                });
            self.termsHTML("");
        }
    };

    profileType.prototype.Reset = function(){
        var self = this;
        self.dirtyFlag(false);
        this.refresh(true);
    };

    profileType.prototype.Submit = function(){
        var self = this;
        // Save User changeables
        self.wallet.User().profile.first_name = self.first_name();
        self.wallet.User().profile.last_name = self.last_name();
        self.wallet.User().profile.email = self.email();
        self.wallet.User().profile.ethaddress = self.ethaddress();
        self.wallet.User().profile.btcaddress = self.btcaddress();
        self.wallet.User().profile.age = self.age();
        self.wallet.User().profile.dob = self.dob();
        self.wallet.User().profile.country = self.country();
        self.wallet.User().profile.terms = self.terms();
        var saveUserProfileCommand = new Command('saveuserprofile',
                                                [encodeURIComponent(btoa(JSON.stringify(self.wallet.User().profile)))],
                                                self.wallet.settings().chRoot,
                                                self.wallet.settings().env);
        saveUserProfileCommand.execute()
            .done(function(data){
                self.statusMessage(data);
                self.dirtyFlag(false);
                self.wallet.initUser(); // wallet needs updating.
            })
            .fail(function(){
                self.statusMessage("Save Error!");
            });
    };

    return profileType;
});
