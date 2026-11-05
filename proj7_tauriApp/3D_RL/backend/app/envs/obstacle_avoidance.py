from .child_world_env import ChildWorldEnv


class ObstacleAvoidanceEnv(ChildWorldEnv):
    """
    Compatible wrapper inheriting all internal Systems (Energy, Drives, Zones)
    from ChildWorldEnv.
    """

    def __init__(self, persist_internal: bool = False):
        super().__init__(persist_internal=persist_internal)
