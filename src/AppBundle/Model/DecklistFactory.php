<?php

namespace AppBundle\Model;

use AppBundle\Entity\Decklist;
use AppBundle\Entity\Deck;
use Doctrine\ORM\EntityManager;
use AppBundle\Helper\DeckValidationHelper;
use AppBundle\Services\Texts;
use AppBundle\Entity\Decklistslot;

class DecklistFactory
{
	public function __construct(EntityManager $doctrine, DeckValidationHelper $deckValidationHelper, Texts $texts)
	{
		$this->doctrine = $doctrine;
		$this->deckValidationHelper = $deckValidationHelper;
		$this->texts = $texts;
	}

	public function createDecklistFromDeck(Deck $deck, $name = null, $descriptionMd = null)
	{
		$lastSet = $deck->getLastSet();
		if(!$lastSet->getDateRelease() || $lastSet->getDateRelease() > new \DateTime()) {
			throw new \Exception("You cannot publish this deck yet, because it has unreleased cards.");
		}
		
		$problem = $this->deckValidationHelper->findProblem($deck);
		if($problem) {
			throw new \Exception('This deck cannot be published  because it is invalid: "'.$this->deckValidationHelper->getProblemLabel($problem).'".');
		}

		// all good for decklist publication

		// increasing deck version
		$deck->setMinorVersion(0);
		$deck->setMajorVersion($deck->getMajorVersion() + 1);

		if(empty($name)) {
			$name = $deck->getName();
		}
		$name = substr($name, 0, 60);

		if(empty($descriptionMd)) {
			$descriptionMd = $deck->getDescriptionMd();
		}
		$description = $this->texts->markdown($descriptionMd);

		$new_content = json_encode($deck->getSlots()->getContent());
		$new_signature = md5($new_content);

		$countByFaction = $deck->getSlots()->getCountByFaction();
        $predominantFaction = array_keys($countByFaction, max($countByFaction))[0];
        $predominantFaction = $this->doctrine->getRepository('AppBundle:Faction')->findOneBy(["code" => $predominantFaction]);
		
		$decklist = new Decklist();
		$decklist->setName($name);
		$decklist->setVersion($deck->getVersion());
		$decklist->setNameCanonical($this->texts->slugify($name) . '-' . $decklist->getVersion());
		$decklist->setDescriptionMd($descriptionMd);
		$decklist->setDescriptionHtml($description);
		$decklist->setDateCreation(new \DateTime());
		$decklist->setDateUpdate(new \DateTime());
		$decklist->setSignature($new_signature);
		$decklist->setAffiliation($deck->getAffiliation());
		$decklist->setFormat($deck->getFormat());
		$decklist->setLastSet($deck->getLastSet());
		$decklist->setNbVotes(0);
		$decklist->setNbfavorites(0);
		$decklist->setNbcomments(0);
		$decklist->setUser($deck->getUser());
		foreach ($deck->getSlots() as $slot) {
			$decklistslot = new Decklistslot();
			$decklistslot->setCard($slot->getCard());
			$decklistslot->setQuantity($slot->getQuantity());
			$decklistslot->setDice($slot->getDice());
			$decklistslot->setDices($slot->getDices());
			$decklistslot->setDecklist($decklist);
			$decklist->getSlots()->add($decklistslot);
		}
		if (count($deck->getChildren())) {
			$decklist->setPrecedent($deck->getChildren()[0]);
		} else {
			if ($deck->getParent()) {
				$decklist->setPrecedent($deck->getParent());
			}
		}
		$decklist->setPredominantFaction($predominantFaction);
		$decklist->setParent($deck);

		$deck->setMinorVersion(1);

		return $decklist;
	}
}
