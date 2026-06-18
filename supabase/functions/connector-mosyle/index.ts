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
      const { data, error } = await sb.from('connector_credentials').select('credentials, sync_data').eq('org_id', org_id).eq('connector_id', 'mosyle').single()
      if (error) throw error
      return data
    }

    function mosyleFetch(token: string, body: unknown) {
      return fetch('https://businessapi.mosyle.com/v1', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', accessToken: token },
        body: JSON.stringify(body),
      })
    }

    // ── TEST ──────────────────────────────────────────────────────────────────
    if (action === 'test') {
      const now = Date.now()
      const groups = [
        { id:'dg1', name:'All iPads',             type:'device', device_count:214 },
        { id:'dg2', name:'All MacBooks',           type:'device', device_count:54  },
        { id:'dg3', name:'Grade 3 - Room 101',    type:'device', device_count:28  },
        { id:'dg4', name:'Grade 4 - Room 102',    type:'device', device_count:30  },
        { id:'dg5', name:'Grade 5 - Room 103',    type:'device', device_count:29  },
        { id:'dg6', name:'Kindergarten Cart A',   type:'device', device_count:25  },
        { id:'dg7', name:'Staff Devices',         type:'device', device_count:31  },
        { id:'dg8', name:'Unassigned',            type:'device', device_count:17  },
      ]
      const devices = [
        { id:'mo001', serial:'F2LN1234AA', asset_tag:'FES-001', name:'iPad-GR3-001', model:'iPad 9th Gen',   group_id:'dg3', group_name:'Grade 3 - Room 101', supervised:true, managed:true, assigned_user:'', os_version:'16.6', last_check_in:new Date(now-3600000).toISOString(), enrolled:new Date('2022-09-01').toISOString(), capacity_gb:64, available_gb:45, battery_pct:88, passcode:true,  activation_lock:false, serial_enrolled:true  },
        { id:'mo002', serial:'F2LN5678BB', asset_tag:'FES-002', name:'iPad-GR3-002', model:'iPad 9th Gen',   group_id:'dg3', group_name:'Grade 3 - Room 101', supervised:true, managed:true, assigned_user:'', os_version:'16.6', last_check_in:new Date(now-7200000).toISOString(), enrolled:new Date('2022-09-01').toISOString(), capacity_gb:64, available_gb:52, battery_pct:71, passcode:true,  activation_lock:false, serial_enrolled:true  },
        { id:'mo003', serial:'F2LN9012CC', asset_tag:'FES-003', name:'iPad-KG-001',  model:'iPad 8th Gen',   group_id:'dg6', group_name:'Kindergarten Cart A', supervised:true, managed:true, assigned_user:'', os_version:'16.5', last_check_in:new Date(now-10800000).toISOString(),enrolled:new Date('2021-09-01').toISOString(), capacity_gb:32, available_gb:18, battery_pct:44, passcode:false, activation_lock:false, serial_enrolled:true  },
        { id:'mo004', serial:'C02XL1111DD', asset_tag:'FES-S01', name:'MacBook-Staff-001', model:'MacBook Air M1', group_id:'dg7', group_name:'Staff Devices', supervised:false, managed:true, assigned_user:'pjones@district.edu', os_version:'13.5.1', last_check_in:new Date(now-1800000).toISOString(), enrolled:new Date('2022-01-10').toISOString(), capacity_gb:256, available_gb:118, battery_pct:95, passcode:true, activation_lock:true, serial_enrolled:true },
        { id:'mo005', serial:'F2LN2222EE', asset_tag:'FES-099', name:'iPad-Unassigned', model:'iPad 9th Gen', group_id:'dg8', group_name:'Unassigned', supervised:true, managed:true, assigned_user:'', os_version:'16.0', last_check_in:new Date(now-604800000).toISOString(), enrolled:new Date('2022-09-01').toISOString(), capacity_gb:64, available_gb:60, battery_pct:5, passcode:false, activation_lock:false, serial_enrolled:false },
      ]
      const profiles = [
        { id:'prf1', name:'Wi-Fi - Franklin Elementary',   type:'WiFi',       scope:'All', deployed:true,  device_count:268 },
        { id:'prf2', name:'Web Filter - Students',         type:'Restrictions',scope:'dg3,dg4,dg5,dg6', deployed:true,  device_count:112 },
        { id:'prf3', name:'App Lock - Guided Access',      type:'Kiosk',      scope:'dg6', deployed:true,  device_count:25  },
        { id:'prf4', name:'VPP App Assignment',            type:'AppInstall', scope:'All', deployed:true,  device_count:268 },
        { id:'prf5', name:'Screen Time Controls',          type:'ScreenTime', scope:'dg3,dg4,dg5', deployed:true, device_count:87 },
      ]
      const apps = [
        { id:'app1', name:'Seesaw',             bundle_id:'com.seesaw.portfolio', scope:'All Students', installed_count:196, vpp:true  },
        { id:'app2', name:'Khan Academy',       bundle_id:'com.khanacademy.student', scope:'Grade 3,4,5', installed_count:87, vpp:true  },
        { id:'app3', name:'Google Classroom',   bundle_id:'com.google.GoogleClassroom', scope:'All', installed_count:268, vpp:false },
        { id:'app4', name:'Book Creator',       bundle_id:'com.redjumper.bookcreatorfree', scope:'Grade 3,4,5', installed_count:87, vpp:true },
        { id:'app5', name:'Numbers',            bundle_id:'com.apple.Numbers', scope:'Staff', installed_count:31, vpp:true },
      ]
      const sync_data = { groups, devices, profiles, apps, synced_at: new Date().toISOString() }
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'mosyle', credentials:{ mode:'mock' }, status:'connected', sync_data, last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true, sync_data })
    }

    if (action === 'save') {
      const { error } = await sb.from('connector_credentials').upsert(
        { org_id, connector_id:'mosyle', credentials:payload.credentials, status:'connected', last_sync:new Date().toISOString() },
        { onConflict:'org_id,connector_id' }
      )
      if (error) throw error
      return respond({ ok:true })
    }
    if (action === 'load') {
      const { data, error } = await sb.from('connector_credentials').select('sync_data, last_sync').eq('org_id', org_id).eq('connector_id', 'mosyle').single()
      if (error) throw error
      return respond({ ok:true, ...data })
    }

    if (action === 'sync') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') throw new Error('Mock mode — use real Mosyle API token')
      const [devRes, grpRes] = await Promise.all([
        mosyleFetch(creds.token, { operation:'list', service:'devices', data:{ specific_columns:['serial_number','device_name','os_version','battery_level','last_check_in','device_model','device_capacity','device_available','supervised','dep_profile_status','device_group_id'] } }),
        mosyleFetch(creds.token, { operation:'list', service:'device_groups', data:{} }),
      ])
      const [devData, grpData] = await Promise.all([devRes.json(), grpRes.json()])
      const devices = (devData.response?.devices || []).map((d: any) => ({ id:d.udid, serial:d.serial_number, name:d.device_name, model:d.device_model, group_id:d.device_group_id, supervised:d.supervised, os_version:d.os_version, last_check_in:d.last_check_in, battery_pct:d.battery_level, capacity_gb:Math.round(d.device_capacity), available_gb:Math.round(d.device_available) }))
      const groups = (grpData.response?.device_groups || []).map((g: any) => ({ id:g.id, name:g.name, device_count:0 }))
      const sync_data = { groups, devices, profiles: [], apps: [], synced_at: new Date().toISOString() }
      await sb.from('connector_credentials').update({ sync_data, last_sync: new Date().toISOString() }).eq('org_id', org_id).eq('connector_id', 'mosyle')
      return respond({ ok:true, counts: { devices: devices.length } })
    }

    if (action === 'lock' || action === 'wipe') {
      const { credentials: creds } = await getCreds()
      if (creds.mode === 'mock') return respond({ ok:true, message:`Mock: ${action} sent` })
      await mosyleFetch(creds.token, { operation: action === 'lock' ? 'lock' : 'erase', service:'devices', data:{ ids:[device_id] } })
      return respond({ ok:true })
    }

    throw new Error('Unknown action: ' + action)
  } catch (e: any) {
    return respond({ ok:false, error: e.message }, 400)
  }
})
