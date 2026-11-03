from ..trainers.ppo_trainer import PPOTrainer

class TrainingService:
    def __init__(self):
        self.trainer = PPOTrainer()

    @property
    def is_training(self):
        return self.trainer.is_training

    @property
    def is_playing(self):
        return self.trainer.is_playing

    def start_training(self, timesteps: int = 80000, n_envs: int = 1):
        if self.is_training:
            return False
        self.trainer.train(total_timesteps=timesteps, n_envs=n_envs)
        return True

    def load_model(self, model_name: str):
        return self.trainer.load_model(model_name)

    def start_play(self, episodes: int = 3):
        if self.trainer.model is None:
            raise ValueError("No model loaded")
        self.trainer.play(episodes=episodes)
        return True

    def stop_play(self):
        self.trainer.is_playing = False

training_service = TrainingService()
