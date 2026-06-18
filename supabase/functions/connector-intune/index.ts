import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const respond = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const payload = await req.json()
    const { action, org_id, device_id } = payload

    async function getCreds() {
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'intune').single()
      if (error) throw error
      return data
    }

    async function getMSToken(creds: any): Promise<string> {
      const res = await fetch(`https://login.microsoftonline.com/${creds.tenant_id}/oauth2/v2.0/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type:'client_credentials', client_id:creds.client_id, client_secret:creds.client_secret, scope:'https://graph.microsoft.com/.default' }),
      })
      if (!res.ok) throw new Error(`MS token error: ${res.status}`)
      return (await res.json()).access_token
    }

    function graphFetch(token: string, path: string, method = 'GET', body?: unknown) {
      return fetch(`https://graph.microsoft.com/v1.0${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'grp-all-windows',  name:'All Windows Devices',    member_count:178, dynamic:true,  rule:"(device.deviceOSType -eq \"Windows\")" },
        { id:'grp-all-ios',      name:'All iOS Devices',        member_count:52,  dynamic:true,  rule:"(device.deviceOSType -eq \"IOS\")" },
        { id:'grp-staff',        name:'Staff - All Schools',    member_count:86,  dynamic:false, rule:'' },
        { id:'grp-hs-students',  name:'HS Students',            member_count:312, dynamic:false, rule:'' },
        { id:'grp-laptops-pilot',name:'Windows 11 Pilot',       member_count:24,  dynamic:false, rule:'' },
      ]
      const devices = [
        { id:'dev001', name:'DISTRICT-ADMIN-01', serial:'PF1234ABC', model:'Surface Pro 9',      os:'Windows',  os_version:'11.0.22621',   compliance:'Compliant',     last_sync:new Date(now-600000).toISOString(),   enrolled:new Date('2023-01-10').toISOString(), user:'admin@district.edu',      user_display:'IT Admin',        managed_by:'Intune', encryption:true,  storage_gb:256, free_gb:98,  manufacturer:'Microsoft', group_id:'grp-staff'        },
        { id:'dev002', name:'LHS-STAFF-DLEE',    serial:'PF5678DEF', model:'HP EliteBook 840 G9', os:'Windows',  os_version:'11.0.22621',   compliance:'Compliant',     last_sync:new Date(now-3600000).toISOString(),  enrolled:new Date('2022-08-01').toISOString(), user:'dlee@district.edu',       user_display:'Dana Lee',        managed_by:'Intune', encryption:true,  storage_gb:512, free_gb:245, manufacturer:'HP',         group_id:'grp-staff'        },
        { id:'dev003', name:'JMS-STAFF-SBROWN',  serial:'MXL2001GHI', model:'Dell Latitude 5430', os:'Windows',  os_version:'10.0.19045',   compliance:'Non-Compliant', last_sync:new Date(now-86400000).toISOString(), enrolled:new Date('2021-09-15').toISOString(), user:'sbrown@district.edu',     user_display:'Sarah Brown',     managed_by:'Intune', encryption:false, storage_gb:256, free_gb:44,  manufacturer:'Dell',       group_id:'grp-staff'        },
        { id:'dev004', name:'LHS-STU-JSMITH',    serial:'5CD3456JKL', model:'iPhone 14',          os:'iOS',      os_version:'16.6',         compliance:'Compliant',     last_sync:new Date(now-7200000).toISOString(),  enrolled:new Date('2023-09-01').toISOString(), user:'jsmith@district.edu',     user_display:'Jordan Smith',    managed_by:'Intune', encryption:true,  storage_gb:128, free_gb:71,  manufacturer:'Apple',      group_id:'grp-all-ios'      },
        { id:'dev005', name:'WIN11-PILOT-01',    serial:'PF9012MNO', model:'Surface Laptop 5',   os:'Windows',  os_version:'11.0.22621',   compliance:'Compliant',     last_sync:new Date(now-1800000).toISOString(),  enrolled:new Date('2023-06-01').toISOString(), user:'mrodriguez@district.edu', user_display:'M. Rodriguez',    managed_by:'Intune', encryption:true,  storage_gb:512, free_gb:310, manufacturer:'Microsoft',  group_id:'grp-laptops-pilot'},
        { id:'dev006', name:'FES-STAFF-LTORRES', serial:'MXL4567PQR', model:'HP EliteBook 645 G9',os:'Windows', os_version:'11.0.22621',   compliance:'Compliant',     last_sync:new Date(now-10800000).toISOString(), enrolled:new Date('2022-08-20').toISOString(), user:'ltorres@district.edu',    user_display:'L. Torres',       managed_by:'Intune', encryption:true,  storage_gb:256, free_gb:112, manufacturer:'HP',         group_id:'grp-staff'        },
      ]
      const compliance_policies = [
        { id:'cp1', name:'Windows 10/11 Baseline',   platform:'Windows', settings:{ require_encryption:true, min_os_version:'10.0.19041', password_required:true, firewall_required:true, antivirus_required:true }, assigned_groups:['grp-all-windows'], noncompliant_count:3 },
        { id:'cp2', name:'iOS Enrollment Policy',    platform:'iOS',     settings:{ require_encryption:true, passcode_required:true, min_os_version:'15.0', jailbreak_detected:false }, assigned_groups:['grp-all-ios'], noncompliant_count:0 },
        { id:'cp3', name:'BitLocker Required',       platform:'Windows', settings:{ require_encryption:true, encryption_type:'BitLocker' }, assigned_groups:['grp-staff'], noncompliant_count:1 },
      ]
      const config_profiles = [
        { id:'cfg1', name:'Wi-Fi - District',         platform:'Windows', type:'WiFi',     assigned_groups:['grp-all-windows'], deployed:true },
        { id:'cfg2', name:'VPN - Staff Access',       platform:'Windows', type:'VPN',      assigned_groups:['grp-staff'],       deployed:true },
        { id:'cfg3', name:'Endpoint Protection',      platform:'Windows', type:'Security', assigned_groups:['grp-all-windows'], deployed:true },
        { id:'cfg4', name:'Email - Microsoft 365',    platform:'iOS',     type:'Email',    assigned_groups:['grp-all-ios'],     deployed:true },
        { id:'cfg5', name:'Restrictions - Students',  platform:'iOS',     type:'Restrict', assigned_groups:['grp-hs-students'], deployed:true },
      ]
      const sync_data = { groups, devices, compliance_policies, config_profiles, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'intune', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    // ── SAVE / LOAD ───────────────────────────────────────────────────────────
    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'intune', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'intune').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    // ── SYNC ──────────────────────────────────────────────────────────────────
    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock credentials — re-authorize to sync live data')
      const token = await getMSToken(creds)
      const [devRes, grpRes] = await Promise.all([
        graphFetch(token, '/deviceManagement/managedDevices?$top=500&$select=id,deviceName,serialNumber,model,operatingSystem,osVersion,complianceState,lastSyncDateTime,enrolledDateTime,userPrincipalName,userDisplayName,manufacturer,totalStorageSpaceInBytes,freeStorageSpaceInBytes,isEncrypted'),
        graphFetch(token, '/groups?$top=200&$select=id,displayName,membershipRule,groupTypes'),
      ])
      const devData = devRes.ok ? await devRes.json() : { value: [] }
      const grpData = grpRes.ok ? await grpRes.json() : { value: [] }
      const devices = (devData.value || []).map((d: any) => ({
        id: d.id, name: d.deviceName, serial: d.serialNumber, model: d.model,
        os: d.operatingSystem, os_version: d.osVersion, compliance: d.complianceState,
        last_sync: d.lastSyncDateTime, enrolled: d.enrolledDateTime,
        user: d.userPrincipalName, user_display: d.userDisplayName,
        manufacturer: d.manufacturer, encryption: d.isEncrypted,
        storage_gb: Math.round(d.totalStorageSpaceInBytes / 1073741824),
        free_gb: Math.round(d.freeStorageSpaceInBytes / 1073741824),
      }))
      const groups = (grpData.value || []).map((g: any) => ({
        id: g.id, name: g.displayName, member_count: 0,
        dynamic: g.groupTypes?.includes('DynamicMembership'), rule: g.membershipRule || '',
      }))
      const sync_data = { groups, devices, compliance_policies: [], config_profiles: [], synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'intune')
      return respond({ ok:true, counts: { devices: devices.length, groups: groups.length } })
    }

    // ── DEVICE ACTIONS ────────────────────────────────────────────────────────
    const deviceActions: Record<string, string> = { sync_device:'syncDevice', restart:'rebootNow', retire:'retire', wipe:'wipe', lock:'remoteLock' }
    if (deviceActions[action]) {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:`Mock: ${action} sent to device ${device_id}` })
      const token = await getMSToken(creds)
      const res = await graphFetch(token, `/deviceManagement/managedDevices/${device_id}/${deviceActions[action]}`, 'POST')
      if (!res.ok) throw new Error(`Intune ${action} error: ${res.status}`)
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
