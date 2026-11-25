from sqlalchemy.orm import Session
from .seeder_prompts import seed_prompts
from .seeder_tools import seed_tools
from .seeder_agents import seed_agents


def run_all_seeders(db: Session):
    seed_prompts(db)
    seed_tools(db)
    seed_agents(db)