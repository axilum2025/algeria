        function openCompanySettings() {
            // Vérifier si le panneau existe déjà
            let panel = document.getElementById('companySettingsPanel');
            if (panel) {
                // Si déjà ouvert, le fermer
                closeCompanySettings();
                return;
            }

            const lang = (typeof getAppLanguage === 'function' && getAppLanguage() === 'en') ? 'en' : 'fr';
            const isEn = (lang === 'en');
            
            const t = {
                title: isEn ? 'Company Settings' : 'Paramètres Entreprise',
                subtitle: isEn ? 'Company Information' : 'Informations de votre entreprise',
                menu: 'MENU',
                nav: {
                    general: isEn ? 'General' : 'Général',
                    contact: isEn ? 'Contact' : 'Contact',
                    currency: isEn ? 'Currency' : 'Devise',
                    legal: isEn ? 'Legal' : 'Légal'
                },
                sectionTitles: {
                    general: isEn ? 'General' : 'Général',
                    contact: isEn ? 'Contact' : 'Contact',
                    currency: isEn ? 'Currency' : 'Devise',
                    legal: isEn ? 'Legal' : 'Légal'
                },
                labels: {
                    companyName: isEn ? 'Company Name *' : "Nom de l'entreprise *",
                    activity: isEn ? 'Activity Field *' : "Domaine d'activité *",
                    address: isEn ? 'Full Address *' : "Adresse complète *",
                    phone: isEn ? 'Phone *' : "Téléphone *",
                    email: isEn ? 'Email *' : "Email *",
                    currency: isEn ? 'Currency *' : "Devise *",
                    registration: isEn ? 'Registration Number (optional)' : "Numéro SIRET/RC (optionnel)"
                },
                placeholders: {
                    companyName: isEn ? 'Ex: Axilum' : 'Ex: Axilum',
                    activity: isEn ? 'Ex: Technology, Commerce, Services...' : 'Ex: Technologies, Commerce, Services...',
                    address: isEn ? 'Street, city, zip code, country...' : 'Rue, ville, code postal, pays...',
                    phone: isEn ? '+1 234 567 890' : '+213 XXX XXX XXX',
                    email: isEn ? 'contact@company.com' : 'contact@entreprise.com',
                    registration: isEn ? 'Registration Number' : "Numéro d'enregistrement"
                },
                buttons: {
                    cancel: isEn ? 'Cancel' : 'Annuler',
                    save: isEn ? 'Save' : 'Enregistrer'
                },
                currencies: {
                    eur: isEn ? 'Euro (€)' : 'Euro (€)',
                    usd: isEn ? 'US Dollar ($)' : 'Dollar US ($)',
                    mad: isEn ? 'Moroccan Dirham (MAD)' : 'Dirham Marocain (MAD)',
                    tnd: isEn ? 'Tunisian Dinar (TND)' : 'Dinar Tunisien (TND)'
                }
            };
            
            // Créer le panneau
            panel = document.createElement('div');
            panel.id = 'companySettingsPanel';
            panel.style.cssText = `
                position: fixed;
                top: 0;
                right: -100%;
                width: 90%;
                max-width: 500px;
                height: 100vh;
                background: white;
                z-index: 10003;
                transition: right 0.3s ease;
                box-shadow: -4px 0 20px rgba(0,0,0,0.15);
                overflow: hidden;
            `;
            
            // Charger les données existantes
            const companyData = getHRData('companySettings', {});
            
            panel.innerHTML = `
                <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #1a1a1a;">${t.title}</h2>
                        <button onclick="closeCompanySettings()" style="width: 36px; height: 36px; background: #f3f4f6; border: none; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <p style="margin: 0; color: #6b7280; font-size: 13px;">${t.subtitle}</p>
                </div>

                <div style="display:flex; height: calc(100vh - 98px);">
                    <div style="width: 170px; border-right: 1px solid #e5e7eb; padding: 14px; background: #f9fafb;">
                        <div style="font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: .04em; text-transform: uppercase; margin: 2px 0 10px;">${t.menu}</div>

                        <button type="button" id="companySettingsNav_general" onclick="showCompanySettingsSection('general')" style="width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid #e5e7eb; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 10px;">
                            ${t.nav.general}
                        </button>
                        <button type="button" id="companySettingsNav_contact" onclick="showCompanySettingsSection('contact')" style="width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid #e5e7eb; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 10px;">
                            ${t.nav.contact}
                        </button>
                        <button type="button" id="companySettingsNav_currency" onclick="showCompanySettingsSection('currency')" style="width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid #e5e7eb; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 10px;">
                            ${t.nav.currency}
                        </button>
                        <button type="button" id="companySettingsNav_legal" onclick="showCompanySettingsSection('legal')" style="width: 100%; text-align: left; padding: 10px 12px; border-radius: 10px; border: 1px solid #e5e7eb; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #111827;">
                            ${t.nav.legal}
                        </button>
                    </div>

                    <div id="companySettingsScroll" style="flex: 1; overflow-y: auto; padding: 18px 18px 24px;">
                        <form id="companySettingsForm" onsubmit="saveCompanySettings(event)" style="display: flex; flex-direction: column; gap: 20px;">

                            <div id="companySettingsSection_general">
                                <div style="font-size: 14px; font-weight: 800; color: #111827; margin: 0 0 12px;">${t.sectionTitles.general}</div>
                                <div style="display:flex; flex-direction:column; gap: 16px;">
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.companyName}</label>
                                        <input type="text" name="companyName" value="${companyData.companyName || ''}" required style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'" placeholder="${t.placeholders.companyName}">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.activity}</label>
                                        <input type="text" name="businessSector" value="${companyData.businessSector || ''}" required style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'" placeholder="${t.placeholders.activity}">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.address}</label>
                                        <textarea name="address" required style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; min-height: 80px; resize: vertical; font-family: inherit; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'" placeholder="${t.placeholders.address}">${companyData.address || ''}</textarea>
                                    </div>
                                </div>
                            </div>

                            <div id="companySettingsSection_contact" style="display:none;">
                                <div style="font-size: 14px; font-weight: 800; color: #111827; margin: 0 0 12px;">${t.sectionTitles.contact}</div>
                                <div style="display:flex; flex-direction:column; gap: 16px;">
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.phone}</label>
                                        <input type="tel" name="phone" value="${companyData.phone || ''}" required style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'" placeholder="${t.placeholders.phone}">
                                    </div>
                                    <div>
                                        <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.email}</label>
                                        <input type="email" name="email" value="${companyData.email || ''}" required style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'" placeholder="${t.placeholders.email}">
                                    </div>
                                </div>
                            </div>

                            <div id="companySettingsSection_currency" style="display:none;">
                                <div style="font-size: 14px; font-weight: 800; color: #111827; margin: 0 0 12px;">${t.sectionTitles.currency}</div>
                                <div>
                                    <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.currency}</label>
                                    <select name="currency" required style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; background: white; cursor: pointer; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'">
                                        <option value="DZD" ${(companyData.currency === 'DZD' || companyData.currency === 'DA') ? 'selected' : ''}>DZD</option>
                                        <option value="EUR" ${companyData.currency === 'EUR' ? 'selected' : ''}>${t.currencies.eur}</option>
                                        <option value="USD" ${companyData.currency === 'USD' ? 'selected' : ''}>${t.currencies.usd}</option>
                                        <option value="MAD" ${companyData.currency === 'MAD' ? 'selected' : ''}>${t.currencies.mad}</option>
                                        <option value="TND" ${companyData.currency === 'TND' ? 'selected' : ''}>${t.currencies.tnd}</option>
                                    </select>
                                </div>
                            </div>

                            <div id="companySettingsSection_legal" style="display:none;">
                                <div style="font-size: 14px; font-weight: 800; color: #111827; margin: 0 0 12px;">${t.sectionTitles.legal}</div>
                                <div>
                                    <label style="display: block; font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 6px;">${t.labels.registration}</label>
                                    <input type="text" name="registrationNumber" value="${companyData.registrationNumber || ''}" style="width: 100%; padding: 10px 14px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; transition: all 0.2s;" onfocus="this.style.borderColor='#6366F1'" onblur="this.style.borderColor='#d1d5db'" placeholder="${t.placeholders.registration}">
                                </div>
                            </div>

                            <div style="display: flex; gap: 12px; margin-top: 12px;">
                                <button type="button" onclick="closeCompanySettings()" style="flex: 1; padding: 12px; background: #f3f4f6; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; font-size: 14px; color: #374151;" onmouseover="this.style.background='#e5e7eb'" onmouseout="this.style.background='#f3f4f6'">${t.buttons.cancel}</button>
                                <button type="submit" style="flex: 1; padding: 12px; background: #10b981; border: none; border-radius: 10px; color: white; font-weight: 600; cursor: pointer; font-size: 14px;" onmouseover="this.style.background='#059669'" onmouseout="this.style.background='#10b981'">${t.buttons.save}</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
            
            document.body.appendChild(panel);
            
            // Animer l'ouverture
            setTimeout(() => {
                panel.style.right = '0';
                try { showCompanySettingsSection('general'); } catch (_) {}
            }, 10);
            
            // Fermer si clic en dehors (optionnel)
            setTimeout(() => {
                document.addEventListener('click', handleClickOutsideCompanyPanel);
            }, 300);
        }

        function showCompanySettingsSection(sectionKey) {
            const panel = document.getElementById('companySettingsPanel');
            if (!panel) return;

            const sections = ['general', 'contact', 'currency', 'legal'];
            const safeKey = sections.includes(String(sectionKey)) ? String(sectionKey) : 'general';

            sections.forEach(k => {
                const el = document.getElementById(`companySettingsSection_${k}`);
                if (el) el.style.display = (k === safeKey) ? 'block' : 'none';

                const nav = document.getElementById(`companySettingsNav_${k}`);
                if (nav) {
                    const isActive = (k === safeKey);
                    nav.style.borderColor = isActive ? '#6366F1' : '#e5e7eb';
                    nav.style.background = isActive ? 'rgba(99, 102, 241, 0.08)' : 'white';
                    nav.style.color = isActive ? '#111827' : '#111827';
                }
            });

            const scroller = document.getElementById('companySettingsScroll');
            if (scroller) scroller.scrollTop = 0;
        }
        
        function handleClickOutsideCompanyPanel(event) {
            const panel = document.getElementById('companySettingsPanel');
            if (panel && !panel.contains(event.target)) {
                const targetButton = event.target.closest('button');
                if (!targetButton || targetButton.onclick?.toString().indexOf('openCompanySettings') === -1) {
                    closeCompanySettings();
                }
            }
        }
        
        function closeCompanySettings() {
