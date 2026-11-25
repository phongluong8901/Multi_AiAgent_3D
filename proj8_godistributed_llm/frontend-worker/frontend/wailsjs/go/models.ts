export namespace agent {
	
	export class LogEntry {
	    time: string;
	    level: string;
	    message: string;
	
	    static createFrom(source: any = {}) {
	        return new LogEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.time = source["time"];
	        this.level = source["level"];
	        this.message = source["message"];
	    }
	}

}

export namespace main {
	
	export class WorkerConfigDTO {
	    worker_id: string;
	    ui_addr: string;
	    transport: string;
	    internal_token: string;
	    grpc_tls_ca: string;
	    max_parallel_jobs: number;
	    supported_models: string[];
	    heartbeat_interval_sec: number;
	    max_job_duration_sec: number;
	    shutdown_grace_sec: number;
	    batch_flush_ms: number;
	    dynamic_model_sync: boolean;
	    llm_provider: string;
	    llm_base_url: string;
	    llm_timeout_sec: number;
	    redis_addr: string;
	    redis_master_name: string;
	    redis_password: string;
	    redis_db: number;
	    consumer_group: string;
	
	    static createFrom(source: any = {}) {
	        return new WorkerConfigDTO(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.worker_id = source["worker_id"];
	        this.ui_addr = source["ui_addr"];
	        this.transport = source["transport"];
	        this.internal_token = source["internal_token"];
	        this.grpc_tls_ca = source["grpc_tls_ca"];
	        this.max_parallel_jobs = source["max_parallel_jobs"];
	        this.supported_models = source["supported_models"];
	        this.heartbeat_interval_sec = source["heartbeat_interval_sec"];
	        this.max_job_duration_sec = source["max_job_duration_sec"];
	        this.shutdown_grace_sec = source["shutdown_grace_sec"];
	        this.batch_flush_ms = source["batch_flush_ms"];
	        this.dynamic_model_sync = source["dynamic_model_sync"];
	        this.llm_provider = source["llm_provider"];
	        this.llm_base_url = source["llm_base_url"];
	        this.llm_timeout_sec = source["llm_timeout_sec"];
	        this.redis_addr = source["redis_addr"];
	        this.redis_master_name = source["redis_master_name"];
	        this.redis_password = source["redis_password"];
	        this.redis_db = source["redis_db"];
	        this.consumer_group = source["consumer_group"];
	    }
	}
	export class DesktopState {
	    running: boolean;
	    config_path: string;
	    last_error?: string;
	    config: WorkerConfigDTO;
	    snapshot: worker.WorkerSnapshot;
	    logs: agent.LogEntry[];
	
	    static createFrom(source: any = {}) {
	        return new DesktopState(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.config_path = source["config_path"];
	        this.last_error = source["last_error"];
	        this.config = this.convertValues(source["config"], WorkerConfigDTO);
	        this.snapshot = this.convertValues(source["snapshot"], worker.WorkerSnapshot);
	        this.logs = this.convertValues(source["logs"], agent.LogEntry);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}
	export class EngineCheckResult {
	    ok: boolean;
	    models: string[];
	    error?: string;
	
	    static createFrom(source: any = {}) {
	        return new EngineCheckResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.ok = source["ok"];
	        this.models = source["models"];
	        this.error = source["error"];
	    }
	}

}

export namespace worker {
	
	export class JobRecord {
	    job_id: string;
	    trace_id?: string;
	    model: string;
	    priority: string;
	    status: string;
	    duration_ms: number;
	    queue_wait_ms: number;
	    tokens_sent: number;
	    error?: string;
	    timestamp: number;
	
	    static createFrom(source: any = {}) {
	        return new JobRecord(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.job_id = source["job_id"];
	        this.trace_id = source["trace_id"];
	        this.model = source["model"];
	        this.priority = source["priority"];
	        this.status = source["status"];
	        this.duration_ms = source["duration_ms"];
	        this.queue_wait_ms = source["queue_wait_ms"];
	        this.tokens_sent = source["tokens_sent"];
	        this.error = source["error"];
	        this.timestamp = source["timestamp"];
	    }
	}
	export class WorkerSnapshot {
	    worker_id: string;
	    status: string;
	    draining: boolean;
	    transport: string;
	    consumer_group: string;
	    llm_provider: string;
	    llm_base_url: string;
	    redis_addr: string;
	    uptime_sec: number;
	    max_slots: number;
	    active_jobs: number;
	    supported_models: string[];
	    dynamic_model_sync: boolean;
	    max_job_duration_sec: number;
	    batch_flush_ms: number;
	    breaker_state: string;
	    breaker_failures: number;
	    breaker_threshold: number;
	    cpu_percent: number;
	    ram_percent: number;
	    gpu_vram_percent: number;
	    jobs_completed: number;
	    jobs_failed: number;
	    jobs_canceled: number;
	    jobs_timed_out: number;
	    total_tokens_sent: number;
	    recent_jobs: JobRecord[];
	
	    static createFrom(source: any = {}) {
	        return new WorkerSnapshot(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.worker_id = source["worker_id"];
	        this.status = source["status"];
	        this.draining = source["draining"];
	        this.transport = source["transport"];
	        this.consumer_group = source["consumer_group"];
	        this.llm_provider = source["llm_provider"];
	        this.llm_base_url = source["llm_base_url"];
	        this.redis_addr = source["redis_addr"];
	        this.uptime_sec = source["uptime_sec"];
	        this.max_slots = source["max_slots"];
	        this.active_jobs = source["active_jobs"];
	        this.supported_models = source["supported_models"];
	        this.dynamic_model_sync = source["dynamic_model_sync"];
	        this.max_job_duration_sec = source["max_job_duration_sec"];
	        this.batch_flush_ms = source["batch_flush_ms"];
	        this.breaker_state = source["breaker_state"];
	        this.breaker_failures = source["breaker_failures"];
	        this.breaker_threshold = source["breaker_threshold"];
	        this.cpu_percent = source["cpu_percent"];
	        this.ram_percent = source["ram_percent"];
	        this.gpu_vram_percent = source["gpu_vram_percent"];
	        this.jobs_completed = source["jobs_completed"];
	        this.jobs_failed = source["jobs_failed"];
	        this.jobs_canceled = source["jobs_canceled"];
	        this.jobs_timed_out = source["jobs_timed_out"];
	        this.total_tokens_sent = source["total_tokens_sent"];
	        this.recent_jobs = this.convertValues(source["recent_jobs"], JobRecord);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

